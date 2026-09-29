import { parseAbi, type Address } from 'viem';

export const ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
export const TOKEN_DECIMALS = 18;
export const MIN_DEBT = 10n * 10n ** 18n;
export const MIN_ANNUAL_INTEREST_RATE = 5n * 10n ** 15n;
export const MAX_ANNUAL_INTEREST_RATE = 25n * 10n ** 17n;
export const LIQUIDATOR_COMPENSATION_WETH = 1_000_000_000_000_000n;
export const MIN_FUSD_IN_STABILITY_POOL = 10n ** 18n;

export const CONTRACTS = {
  spyToken: '0x8823b40A23387Df76E127744FFB38b26eB012A5c',
  spyChainlinkAggregator: '0xcc794A65915A7Ec2B4753bB9d6b983C60035cd74',
  metadataNft: '0x09F7156AAE9C903F90B1CB1E312582C4f208A759',
  base: '0x79070369bf7539483a9a0a256b7d126e4b03a6a7',
  boldToken: '0xfc3e6bd02605f609f962a1e13705e5d9a21b206b',
  collateralRegistry: '0xade0b1fee76e3016f8d3e364b9da25c5648f286c',
  hintHelpers: '0x5c65d65df809fe09f88985f0ed74430688f92d84',
  multiTroveGetter: '0x6c98a67d418d79728581958ecd2aba530a12d64a',
  activePool: '0x4fb3f66bbeec447f000731cac3a6d96f892286a8',
  borrowerOperations: '0x90e8728f7a4ec88469a1df0e85ffbacd4895a0d6',
  collSurplusPool: '0x1eb6f459e4150cfe85f029bdb20cc7a4a81e1628',
  defaultPool: '0x9a32a9f41517958b48e884ee1be7af7d5e653595',
  gasPool: '0xa8b0ffd5bc8f32ca5ad30d6d9fbafcfbd8746d57',
  sortedTroves: '0x8cab45712316e93b27d514e23be7c246a9d97d20',
  stabilityPool: '0xfd90a40cfc4825621debef6c2a3b9ff15c44e286',
  troveManager: '0xab8cc5790a0b8cc4cd40f1be0c239e568b028b6b',
  troveNft: '0x52e8127cc9e0c8fbf4cff05036c5a7fdbabd7545',
  spyPriceFeed: '0xd504f01637b349b079ecfd921a6eece16d17d146',
  weth: '0x7943e237c7F95DA44E0301572D358911207852Fa',
} as const satisfies Record<string, Address>;

export const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

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
  'function lastGoodPrice() view returns (uint256)',
]);

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
  if (borrowed < MIN_DEBT) return 'Borrow at least 10 FUSD.';
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

export function randomOwnerIndex(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return BigInt(`0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`);
}
