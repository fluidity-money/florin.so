import { parseAbi, type Address } from 'viem';

export const ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
export const TOKEN_DECIMALS = 18;
export const MIN_DEBT = 10n * 10n ** 18n;
export const MIN_ANNUAL_INTEREST_RATE = 5n * 10n ** 15n;
export const MAX_ANNUAL_INTEREST_RATE = 25n * 10n ** 17n;
export const LIQUIDATOR_COMPENSATION_ETH = 37_500_000_000_000_000n;

export const CONTRACTS = {
  spyToken: '0x568dABdd832B43A5a457aeC2db8D15c7C0C792C0',
  spyChainlinkAggregator: '0x01923e86C24c09f75E2aed0a6c9491cf0830966d',
  metadataNft: '0x03C8fF583660b689b80DcF6331902AB518b21EAB',
  base: '0x93863e629f79ee44fdaa7f297b60d5eb3049b83e',
  boldToken: '0x4eb936ba9b0be99bc26b5d1aaca39ce7620ef1be',
  collateralRegistry: '0xe603b097bdb3ac3d81b1360b224cf6af69535d96',
  hintHelpers: '0x21d9f8f59f35281caa9f8fbe168dbe1c12280cd6',
  multiTroveGetter: '0xb5b3132cbc630872a65b3fa7561605619865dc00',
  activePool: '0x5667d89070754baa873e67138517a217e242d7ff',
  borrowerOperations: '0x22402645151e526040b84fa156a11f44974eb246',
  collSurplusPool: '0x99183d5ca52a56783e2e0c732e92c5c81de76f88',
  defaultPool: '0xc37d9e918690b6ae9c6d36d5565c5e57ab2c9ba4',
  gasPool: '0xb9e4e845b2d50f0ddacb317499247b80520ed1ba',
  sortedTroves: '0x7f076b371448b2805c070f77b57477b67017017f',
  stabilityPool: '0x607810eaa0dfff2e67abc3cba8919d03cf4916d0',
  troveManager: '0xd0199b724aff6e73ba3891bf15d6be0787b145db',
  troveNft: '0xac9716503258f3146c957c47489428831247cd1d',
  spyPriceFeed: '0xcdd362415fca36f14073d2bf17fe3ae112c6fbc4',
} as const satisfies Record<string, Address>;

export const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export const hintHelpersAbi = parseAbi([
  'function getApproxHint(uint256 collIndex, uint256 interestRate, uint256 numTrials, uint256 inputRandomSeed) view returns (uint256 hintId, uint256 diff, uint256 latestRandomSeed)',
  'function predictOpenTroveUpfrontFee(uint256 collIndex, uint256 borrowed, uint256 annualInterestRate) view returns (uint256)',
]);

export const sortedTrovesAbi = parseAbi([
  'function size() view returns (uint256)',
  'function findInsertPosition(uint256 annualInterestRate, uint256 prevId, uint256 nextId) view returns (uint256 upperHint, uint256 lowerHint)',
]);

export const borrowerOperationsAbi = parseAbi([
  'function openTrove(address owner, uint256 ownerIndex, uint256 collAmount, uint256 boldAmount, uint256 upperHint, uint256 lowerHint, uint256 annualInterestRate, uint256 maxUpfrontFee, address addManager, address removeManager, address receiver) payable returns (uint256 troveId)',
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
