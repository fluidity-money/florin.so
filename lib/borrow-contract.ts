import { hashDomain, parseAbi, parseSignature, parseUnits, type Address, type Hex, type PublicClient } from 'viem';

export const ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
export const TOKEN_DECIMALS = 18;
export const MIN_DEBT = 1_000n * 10n ** 18n;
export const MIN_ANNUAL_INTEREST_RATE = 5n * 10n ** 15n;
export const MAX_ANNUAL_INTEREST_RATE = 25n * 10n ** 17n;
export const LIQUIDATOR_COMPENSATION_WETH = 1_000_000_000_000_000n;
export const MIN_FUSD_IN_STABILITY_POOL = 10n ** 18n;

// florin-contracts/contracts/addresses/46630.json, SPY branch (index 0).
// gasCompZapper is the user-supplied deployment, checked against live branch wiring.
// base is the branch AddressesRegistry; spyPriceFeed is the branch protocol price feed.
export const CONTRACTS = {
  gasCompZapper: '0x90910002956b3C881B74910F5f144b6a73dCcFbe',
  spyToken: '0x8823b40A23387Df76E127744FFB38b26eB012A5c',
  metadataNft: '0xd2e22b2a1ec0b287cb550e92255694aaa0b6e133',
  base: '0xd48655f1fc1a6648246cc9802c6ee5190c93fec0',
  boldToken: '0x1f93de989cd9d30b2c31f3227769632729858196',
  collateralRegistry: '0xeb264317b915cb1a8c8e3ca27dd270d947bba968',
  hintHelpers: '0xcd8bf0cb142d8e612b9685772b2c5439240c1ba5',
  multiTroveGetter: '0x8fac04bbcaadced3074a2909d9490510033b4caa',
  activePool: '0xf00a7eb2cf0d8dee71788bbb99d57d8a4ef98775',
  borrowerOperations: '0xfea06161dbd14374ee6a746eae3502a1a6741990',
  collSurplusPool: '0x43a5c00937b4aec0b56f0e12dedd2247e4a454f7',
  defaultPool: '0x47697a6400bd3848519f469bbc0824b954826e66',
  gasPool: '0xdc6041cc3ba941e96421ed13e26b2f4ffefb7b71',
  sortedTroves: '0x83311690476dfa9239b55e732b4b6638a15142df',
  stabilityPool: '0x9543b191c66c4fa68b9b7888df65b661842ace1b',
  troveManager: '0xc1ebb33678176d7fb5c8fef3ba5a610d50bacc63',
  troveNft: '0xe361393f4d0f3b40eca34c7a83e27e4b5dcfa1c3',
  spyPriceFeed: '0xb7dc3a2596e9a0571b6e104d2f1a3d35b0653862',
  weth: '0x7943e237c7F95DA44E0301572D358911207852Fa',
} as const satisfies Record<string, Address>;

export const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

// Handwritten from GasCompZapper / IZapper. Compensation is native ETH, not SPY.
export const gasCompZapperAbi = parseAbi([
  'function openTroveWithRawETHPermit((uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) permit, (address owner, uint256 ownerIndex, uint256 collAmount, uint256 boldAmount, uint256 upperHint, uint256 lowerHint, uint256 annualInterestRate, address batchManager, uint256 maxUpfrontFee, address addManager, address removeManager, address receiver) params) payable returns (uint256)',
  'function collToken() view returns (address)',
  'function borrowerOperations() view returns (address)',
  'function WETH() view returns (address)',
]);

export const collateralPermitAbi = parseAbi([
  'function nonces(address owner) view returns (uint256)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
  'function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)',
]);

export const permitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export async function prepareCollateralPermit(
  client: Pick<PublicClient, 'readContract' | 'getBlock' | 'getChainId'>,
  owner: Address,
  value: bigint,
) {
  if (value <= 0n) throw new Error('Enter SPY collateral.');
  if (await client.getChainId() !== ROBINHOOD_TESTNET_CHAIN_ID) throw new Error('Wrong permit network.');
  const block = await client.getBlock();
  const token = { address: CONTRACTS.spyToken, abi: collateralPermitAbi, blockNumber: block.number } as const;
  const zapper = { address: CONTRACTS.gasCompZapper, abi: gasCompZapperAbi, blockNumber: block.number } as const;
  const [metadata, separator, nonce, collateral, borrowerOperations, weth] = await Promise.all([
    client.readContract({ ...token, functionName: 'eip712Domain' }),
    client.readContract({ ...token, functionName: 'DOMAIN_SEPARATOR' }),
    client.readContract({ ...token, functionName: 'nonces', args: [owner] }),
    client.readContract({ ...zapper, functionName: 'collToken' }),
    client.readContract({ ...zapper, functionName: 'borrowerOperations' }),
    client.readContract({ ...zapper, functionName: 'WETH' }),
  ]);
  if (collateral.toLowerCase() !== CONTRACTS.spyToken.toLowerCase()
    || borrowerOperations.toLowerCase() !== CONTRACTS.borrowerOperations.toLowerCase()
    || weth.toLowerCase() !== CONTRACTS.weth.toLowerCase()) {
    throw new Error('Unsupported GasCompZapper deployment.');
  }
  const [fields, name, version, chainId, verifyingContract, , extensions] = metadata;
  if (fields !== '0x0f' || extensions.length !== 0
    || chainId !== BigInt(ROBINHOOD_TESTNET_CHAIN_ID)
    || verifyingContract.toLowerCase() !== CONTRACTS.spyToken.toLowerCase()) {
    throw new Error('Unsupported SPY permit domain.');
  }
  const domain = { name, version, chainId, verifyingContract };
  const domainTypes = { EIP712Domain: [
    { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
  ] } as const;
  if (hashDomain({ domain, types: domainTypes }).toLowerCase() !== separator.toLowerCase()) {
    throw new Error('SPY permit domain separator mismatch.');
  }
  return {
    domain, types: permitTypes, primaryType: 'Permit' as const,
    message: { owner, spender: CONTRACTS.gasCompZapper, value, nonce, deadline: block.timestamp + 1_200n },
  };
}

export function collateralPermitParams(value: bigint, deadline: bigint, signature: Hex) {
  const { r, s, yParity } = parseSignature(signature);
  if (yParity !== 0 && yParity !== 1) throw new Error('Unsupported permit signature.');
  return { value, deadline, v: 27 + yParity, r, s };
}

export const stabilityPoolAbi = parseAbi([
  'function getTotalBoldDeposits() view returns (uint256)',
  'function getCompoundedBoldDeposit(address depositor) view returns (uint256)',
  'function getDepositorCollGain(address depositor) view returns (uint256)',
  'function getDepositorYieldGainWithPending(address depositor) view returns (uint256)',
  'function stashedColl(address depositor) view returns (uint256)',
  'function deposits(address depositor) view returns (uint256 initialValue)',
  'function provideToSP(uint256 topUp, bool doClaim)',
  'function withdrawFromSP(uint256 amount, bool doClaim)',
  'function claimAllCollGains()',
]);

export const wethAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function deposit() payable',
]);

export const hintHelpersAbi = parseAbi([
  'function getApproxHint(uint256 collIndex, uint256 interestRate, uint256 numTrials, uint256 inputRandomSeed) view returns (uint256 hintId, uint256 diff, uint256 latestRandomSeed)',
  'function predictOpenTroveUpfrontFee(uint256 collIndex, uint256 borrowed, uint256 annualInterestRate) view returns (uint256)',
  'function predictAdjustTroveUpfrontFee(uint256 collIndex, uint256 troveId, uint256 debtIncrease) view returns (uint256)',
  'function predictAdjustInterestRateUpfrontFee(uint256 collIndex, uint256 troveId, uint256 newAnnualInterestRate) view returns (uint256)',
]);

// LatestTroveData field order and Troves getter match the deployment's TroveManager.
export const troveManagerAbi = parseAbi([
  'function getLatestTroveData(uint256 troveId) view returns ((uint256 entireDebt, uint256 entireColl, uint256 redistBoldDebtGain, uint256 redistCollGain, uint256 accruedInterest, uint256 recordedDebt, uint256 annualInterestRate, uint256 weightedRecordedDebt, uint256 accruedBatchManagementFee, uint256 lastInterestRateAdjTime))',
  'function Troves(uint256 troveId) view returns (uint256 debt, uint256 coll, uint256 stake, uint8 status, uint64 arrayIndex, uint64 lastDebtUpdateTime, uint64 lastInterestRateAdjTime, uint256 annualInterestRate, address interestBatchManager, uint256 batchDebtShares)',
]);

export function validateTroveManager(manager: string): void {
  if (manager.toLowerCase() !== CONTRACTS.troveManager.toLowerCase()) {
    throw new Error('This position belongs to an unsupported TroveManager deployment.');
  }
}

export async function readLivePosition(client: Pick<PublicClient, 'readContract'>, manager: string, troveId: bigint) {
  validateTroveManager(manager);
  const [latest, trove] = await Promise.all([
    client.readContract({
      address: CONTRACTS.troveManager, abi: troveManagerAbi,
      functionName: 'getLatestTroveData', args: [troveId],
    }),
    client.readContract({
      address: CONTRACTS.troveManager, abi: troveManagerAbi,
      functionName: 'Troves', args: [troveId],
    }),
  ]);
  if (trove[3] !== 1 && trove[3] !== 4) throw new Error('This position is no longer open.');
  return { ...latest, interestBatchManager: trove[8] };
}

// React Query retains cached data on failed refetches. Never authorize from it.
export function requireFreshRead<T>(result: { data?: T; isError: boolean; error?: unknown }): T {
  if (result.isError || result.data === undefined) {
    throw result.error ?? new Error('Live position data is unavailable.');
  }
  return result.data;
}

export function maxWithdrawableCollateral(collateral: bigint, debt: bigint, price: bigint): bigint {
  if (price <= 0n || collateral < 0n || debt < 0n) throw new Error('Invalid position or oracle price.');
  const denominator = price * 10n;
  const requiredCollateral = (debt * 11n * 10n ** 18n + denominator - 1n) / denominator;
  return collateral > requiredCollateral ? collateral - requiredCollateral : 0n;
}

export function rateChangePreview(collateral: bigint, debt: bigint, price: bigint, rate: bigint, fee: bigint) {
  const resultingDebt = debt + fee;
  const annualInterest = resultingDebt * rate / 10n ** 18n;
  return {
    fee,
    resultingDebt,
    annualInterest,
    monthlyInterest: annualInterest / 12n,
    safe: price > 0n && collateral * price * 10n >= resultingDebt * 11n * 10n ** 18n,
  };
}

export const sortedTrovesAbi = parseAbi([
  'function size() view returns (uint256)',
  'function findInsertPosition(uint256 annualInterestRate, uint256 prevId, uint256 nextId) view returns (uint256 upperHint, uint256 lowerHint)',
]);

export const borrowerOperationsAbi = parseAbi([
  'function openTrove(address owner, uint256 ownerIndex, uint256 collAmount, uint256 boldAmount, uint256 upperHint, uint256 lowerHint, uint256 annualInterestRate, uint256 maxUpfrontFee, address addManager, address removeManager, address receiver) returns (uint256 troveId)',
  'function addColl(uint256 troveId, uint256 collAmount)',
  'function withdrawColl(uint256 troveId, uint256 collAmount)',
  'function withdrawBold(uint256 troveId, uint256 boldAmount, uint256 maxUpfrontFee)',
  'function repayBold(uint256 troveId, uint256 boldAmount)',
  'function adjustTroveInterestRate(uint256 troveId, uint256 newAnnualInterestRate, uint256 upperHint, uint256 lowerHint, uint256 maxUpfrontFee)',
  'function closeTrove(uint256 troveId)',
  'error TroveExists()',
  'error ICRBelowMCRPlusBCR()',
  'error DebtBelowMin()',
  'error ICRBelowMCR()',
  'error TCRBelowCCR()',
  'error UpfrontFeeTooHigh()',
  'error InterestRateTooLow()',
  'error InterestRateTooHigh()',
  'error NewOracleFailureDetected()',
  'error IsShutDown()',
  'error ZeroAdjustment()',
  'error CollWithdrawalTooHigh()',
  'error NotEnoughBoldBalance()',
  'error TroveInBatch()',
  'error InterestRateNotNew()',
]);

export const priceFeedAbi = parseAbi([
  'function fetchPrice() returns (uint256 price, bool newOracleFailure)',
]);

export function validatedOraclePrice(result: readonly [bigint, boolean]): bigint {
  const [price, newOracleFailure] = result;
  if (newOracleFailure) throw new Error('The SPY oracle reported a new failure.');
  if (price <= 0n) throw new Error('The SPY oracle returned an invalid price.');
  return price;
}

export function maxUpfrontFee(predictedFee: bigint): bigint {
  if (predictedFee === 0n) return 0n;
  return predictedFee + predictedFee / 10n + 1n;
}

export function requiredSpyApproval(collateral: bigint): bigint {
  return collateral;
}

export function requiredWethWrap(wethBalance: bigint): bigint {
  return wethBalance < LIQUIDATOR_COMPENSATION_WETH
    ? LIQUIDATOR_COMPENSATION_WETH - wethBalance
    : 0n;
}

export type PositionAmountMode = 'deposit' | 'withdraw' | 'borrow' | 'repay';

export function validatePositionAmount(
  mode: PositionAmountMode,
  amount: bigint,
  available: bigint,
): string | null {
  if (amount <= 0n) return `Enter an amount to ${mode}.`;
  if (mode === 'borrow' || amount <= available) return null;
  if (mode === 'deposit') return 'You do not have enough SPY.';
  if (mode === 'withdraw') return 'The position does not have that much SPY.';
  return 'You do not have enough FUSD.';
}

export function maxRepayableDebt(debt: bigint): bigint {
  return debt > MIN_DEBT ? debt - MIN_DEBT : 0n;
}

export function annualRateFromDisplayPercent(displayPercent: string): bigint | null {
  try {
    // Graph exposes a display percent (for example "5.25%"). Dividing by 100
    // while converting to WAD is equivalent to parsing with 16 decimals.
    const normalized = displayPercent.trim().replace(/%$/, '').trim();
    if (!normalized) return null;
    return parseUnits(normalized, 16);
  } catch {
    return null;
  }
}

export function maxBorrowPrincipal(
  debtCapacity: bigint,
  currentDebt: bigint,
  feeQuotedAtCapacity: bigint,
): bigint {
  const debtRoom = debtCapacity > currentDebt ? debtCapacity - currentDebt : 0n;
  return debtRoom > feeQuotedAtCapacity ? debtRoom - feeQuotedAtCapacity : 0n;
}

export function validateStabilityPoolAmount(
  mode: 'deposit' | 'withdraw',
  amount: bigint,
  available: bigint,
  totalDeposits?: bigint,
): string | null {
  if (amount <= 0n) return `Enter an amount to ${mode}.`;
  if (amount > available) {
    return mode === 'deposit'
      ? 'You do not have enough FUSD.'
      : 'You do not have that much FUSD deposited.';
  }
  if (totalDeposits !== undefined) {
    if (
      mode === 'deposit'
      && totalDeposits < MIN_FUSD_IN_STABILITY_POOL
      && totalDeposits + amount < MIN_FUSD_IN_STABILITY_POOL
    ) {
      return 'Deposit enough FUSD to bring the Stability Pool total to at least 1 FUSD.';
    }
    if (mode === 'withdraw' && totalDeposits - amount < MIN_FUSD_IN_STABILITY_POOL) {
      return 'This withdrawal must leave at least 1 FUSD in the Stability Pool.';
    }
  }
  return null;
}

export function validateOpenTrove(
  collateral: bigint,
  borrowed: bigint,
  annualInterestRate: bigint,
): string | null {
  if (collateral <= 0n) return 'Enter SPY collateral.';
  if (borrowed < MIN_DEBT) return 'Borrow at least 1,000 FUSD.';
  if (annualInterestRate < MIN_ANNUAL_INTEREST_RATE) {
    return 'Choose an interest rate of at least 0.5%.';
  }
  if (annualInterestRate > MAX_ANNUAL_INTEREST_RATE) {
    return 'Choose an interest rate no higher than 250%.';
  }
  return null;
}

export function hintTrials(troveCount: bigint): bigint {
  if (troveCount === 0n) return 1n;
  return BigInt(Math.max(1, Math.ceil(15 * Math.sqrt(Number(troveCount)))));
}

// Robinhood's public RPC caps eth_call at 50M gas. Keep each sampling
// call small rather than letting the sqrt(position count) search exceed it.
const HINT_TRIALS_PER_CALL = 50n;

export async function getApproxHintBatched(
  client: Pick<PublicClient, 'readContract'>,
  interestRate: bigint,
  troveCount: bigint,
  seed = BigInt(Date.now()),
): Promise<bigint> {
  if (troveCount === 0n) return 0n;
  let remainingSamples = hintTrials(troveCount) - 1n;
  let bestHint = 0n;
  let bestDiff: bigint | undefined;
  do {
    const trials = remainingSamples + 1n < HINT_TRIALS_PER_CALL
      ? remainingSamples + 1n
      : HINT_TRIALS_PER_CALL;
    const [hint, diff, nextSeed] = await client.readContract({
      address: CONTRACTS.hintHelpers,
      abi: hintHelpersAbi,
      functionName: 'getApproxHint',
      args: [0n, interestRate, trials, seed],
    });
    if (bestDiff === undefined || diff < bestDiff) {
      bestHint = hint;
      bestDiff = diff;
    }
    seed = nextSeed;
    // Each call initializes its candidate from the tail, then samples trials - 1 times.
    remainingSamples -= trials - 1n;
  } while (remainingSamples > 0n);
  return bestHint;
}

export function randomOwnerIndex(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return BigInt(`0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`);
}
