import { formatUnits, parseAbi, type PublicClient } from 'viem';
import { CONTRACTS, hintHelpersAbi, priceFeedAbi, validatedOraclePrice, MIN_DEBT, validateOpenTrove, maxUpfrontFee } from './borrow-contract';

const WAD = 10n ** 18n;
export const OPENING_STEP = 10n ** 16n; // Max fills cents; manual input can retain wei precision.
const UINT256_MAX = (1n << 256n) - 1n;
export const OPENING_MAX_AGE_MS = 30_000;
const branchAbi = parseAbi([
  'function MCR() view returns (uint256)',
  'function CCR() view returns (uint256)',
  'function getEntireBranchColl() view returns (uint256)',
  'function getEntireBranchDebt() view returns (uint256)',
  'function activePool() view returns (address)',
  'function hasBeenShutDown() view returns (bool)',
]);
const poolAbi = parseAbi([
  'function aggRecordedDebt() view returns (uint256)',
  'function calcPendingAggInterest() view returns (uint256)',
  'function aggWeightedDebtSum() view returns (uint256)',
]);
type Client = Pick<PublicClient, 'getBlock' | 'readContract' | 'simulateContract'>;
export type OpeningState = {
  blockNumber: bigint; blockHash: string; readAt: number;
  price: bigint; mcr: bigint; ccr: bigint; collateral: bigint; debt: bigint;
  feeDebt: bigint; weightedDebt: bigint;
};

export async function readOpeningState(client: Client): Promise<OpeningState> {
  const readAt = Date.now();
  const block = await client.getBlock({ blockTag: 'latest' });
  if (block.number === null || !block.hash) throw new Error('Opening block unavailable.');
  const blockNumber = block.number;
  const read = <N extends 'MCR' | 'CCR' | 'getEntireBranchColl' | 'getEntireBranchDebt' | 'activePool' | 'hasBeenShutDown'>(functionName: N) =>
    client.readContract({ address: CONTRACTS.borrowerOperations, abi: branchAbi, functionName, blockNumber });
  const [oracle, mcr, ccr, collateral, debt, pool, shutDown] = await Promise.all([
    client.simulateContract({ address: CONTRACTS.spyPriceFeed, abi: priceFeedAbi, functionName: 'fetchPrice', blockNumber }),
    read('MCR'), read('CCR'), read('getEntireBranchColl'), read('getEntireBranchDebt'), read('activePool'), read('hasBeenShutDown'),
  ]);
  if (shutDown) throw new Error('This borrowing branch is shut down.');
  const [recorded, interest, weightedDebt] = await Promise.all([
    client.readContract({ address: pool, abi: poolAbi, functionName: 'aggRecordedDebt', blockNumber }),
    client.readContract({ address: pool, abi: poolAbi, functionName: 'calcPendingAggInterest', blockNumber }),
    client.readContract({ address: pool, abi: poolAbi, functionName: 'aggWeightedDebtSum', blockNumber }),
  ]);
  const state = { blockNumber, blockHash: block.hash, readAt, price: validatedOraclePrice(oracle.result), mcr, ccr, collateral, debt, feeDebt: recorded + interest, weightedDebt };
  openingDebtCapacity(state, 0n); // Reject invalid parameters even before an amount is entered.
	// Validate the snapshot before publishing it independently of an amount quote.
	const canonical = await client.getBlock({ blockNumber });
	if (canonical.hash !== state.blockHash) throw new Error('Opening block changed. Refresh and review.');
	return requireOpeningQuote({ isError: false, data: state });
}

export function openingDebtCapacity(state: Pick<OpeningState, 'price' | 'mcr' | 'ccr' | 'collateral' | 'debt'>, deposit: bigint) {
  if (state.price <= 0n || state.mcr <= 0n || state.ccr <= 0n || deposit < 0n) throw new Error('Invalid opening capacity inputs.');
  const individual = deposit * state.price / state.mcr;
  const branch = (state.collateral + deposit) * state.price / state.ccr - state.debt;
  return branch <= 0n ? 0n : branch < individual ? branch : individual;
}

// HintHelpers -> ActivePool: floor((weightedDebt + principal * rate) /
// (recordedDebt + pendingInterest + principal)). The fee is NOT linear.
// Dropping the average-rate floor gives a continuous fee; subtracting one unit
// of rate gives a lower envelope. Its positive part is monotone for rate >= 1.
// This avoids assuming the rounded onchain fee itself is monotone at every wei.
export function openingFeeLowerBound(principal: bigint, feeDebt: bigint, weightedDebt: bigint, rate: bigint) {
  const denominator = feeDebt + principal;
  if (denominator === 0n) return 0n;
  const numerator = weightedDebt + principal * rate - denominator;
  return numerator <= 0n ? 0n : principal * numerator * 7n / (denominator * 365n * WAD);
}

export async function solveOpeningMax(capacity: bigint, feeDebt: bigint, weightedDebt: bigint, rate: bigint, predict: (principal: bigint) => Promise<bigint>) {
  if (capacity < 0n || capacity > UINT256_MAX || feeDebt < 0n || weightedDebt < 0n || rate < 1n) throw new Error('Invalid opening solver inputs.');
  if (capacity < MIN_DEBT) return 0n;
  let low = 0n;
  let high = capacity / OPENING_STEP;
  // At most 256 local bigint iterations. Find an upper bound on the highest
  // executable cent, then check actual contract predictions descending from it.
  while (low < high) {
    const mid = (low + high + 1n) / 2n;
    const principal = mid * OPENING_STEP;
    if (principal + openingFeeLowerBound(principal, feeDebt, weightedDebt, rate) <= capacity) low = mid;
    else high = mid - 1n;
  }
  // Usually one RPC: the envelope differs by < principal * 7 / (365 * 1e18)
  // wei. Bound pathological magnitudes explicitly; never return an approximation.
  for (let calls = 0; calls < 256 && low > 0n; calls++, low--) {
    const principal = low * OPENING_STEP;
    const fee = await predict(principal);
    if (fee < openingFeeLowerBound(principal, feeDebt, weightedDebt, rate)) throw new Error('Opening fee model changed.');
    if (principal + fee <= capacity && principal + fee >= MIN_DEBT) return principal;
    // The continuous (unfloored-rate) fee is a monotone upper envelope.
    // If even it is below the minimum, no smaller principal can open a trove.
    const upperFee = principal * (weightedDebt + principal * rate) * 7n / ((feeDebt + principal) * 365n * WAD);
    if (principal + upperFee < MIN_DEBT) return 0n;
  }
  if (low === 0n) return 0n;
  throw new Error('Exact opening Max could not be resolved. Try a smaller collateral amount.');
}

export function formatOpeningMax(amount: bigint) {
  const cents = amount / OPENING_STEP;
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

export function validateOpeningAmount(deposit: bigint, principal: bigint, rate: bigint, fee: bigint, capacity: bigint) {
  // Shared legacy validation is principal-based. Normal opening must instead
  // use BorrowerOperations' entireDebt >= MIN_DEBT rule (leverage unchanged).
  const base = validateOpenTrove(deposit, principal + fee, rate);
  if (base) return principal + fee < MIN_DEBT ? `Total debt including the upfront fee must be at least ${formatUnits(MIN_DEBT, 18)} FUSD.` : base;
  if (principal <= 0n) return 'Enter an amount to borrow.';
  if (fee < 0n || principal + fee > capacity) return 'Amount exceeds the current individual or branch borrowing limit. Review the amount and try again.';
  return null;
}

export function requireOpeningQuote<T extends { readAt: number }>(query: { data?: T; isError: boolean }, now = Date.now()): T {
  if (query.isError || !query.data || now - query.data.readAt > OPENING_MAX_AGE_MS || now < query.data.readAt) throw new Error('Opening limits are unavailable or stale. Refresh and review before submitting.');
  return query.data;
}

export async function quoteOpening(client: Client, deposit: bigint, principal: bigint, rate: bigint, includeMax = true) {
	// Submission always takes this uncached path, even when the UI snapshot is fresh.
	return quoteOpeningFromState(client, await readOpeningState(client), deposit, principal, rate, includeMax);
}

export async function quoteOpeningFromState(client: Client, state: OpeningState, deposit: bigint, principal: bigint, rate: bigint, includeMax = true) {
	requireOpeningQuote({ isError: false, data: state });
  const capacity = openingDebtCapacity(state, deposit);
  const predict = (amount: bigint) => client.readContract({ address: CONTRACTS.hintHelpers, abi: hintHelpersAbi, functionName: 'predictOpenTroveUpfrontFee', args: [0n, amount, rate], blockNumber: state.blockNumber });
  const [fee, maxPrincipal] = await Promise.all([
    principal > 0n ? predict(principal) : Promise.resolve(0n),
    includeMax ? solveOpeningMax(capacity, state.feeDebt, state.weightedDebt, rate, predict) : Promise.resolve(0n),
  ]);
  // Number-pinned calls must also refer to the same canonical block across a reorg.
  const block = await client.getBlock({ blockNumber: state.blockNumber });
  if (block.hash !== state.blockHash) throw new Error('Opening block changed. Refresh and review.');
  return requireOpeningQuote({ isError: false, data: { ...state, capacity, fee, maxPrincipal } });
}

export function reviewOpeningRefresh(previous: { capacity: bigint; fee: bigint }, fresh: { capacity: bigint; fee: bigint }, deposit: bigint, principal: bigint, rate: bigint) {
  const error = validateOpeningAmount(deposit, principal, rate, fresh.fee, fresh.capacity);
  if (error) throw new Error(error);
  // Harmless capacity changes must not force endless retries as interest accrues.
  // Keep the existing reviewed fee tolerance, but cap it to actual debt headroom.
  const reviewedFeeLimit = maxUpfrontFee(previous.fee);
  const headroom = fresh.capacity - principal;
  const feeLimit = headroom < reviewedFeeLimit ? headroom : reviewedFeeLimit;
  if (fresh.fee > feeLimit) throw new Error('Upfront fee changed beyond the reviewed limit. Review the refreshed amounts and submit again.');
  return feeLimit;
}
