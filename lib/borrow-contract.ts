import { parseAbi, type Address } from 'viem';

export const ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
export const TOKEN_DECIMALS = 18;
export const WAD = 10n ** 18n;
export const MIN_DEBT = 2_000n * WAD;
export const MIN_ANNUAL_INTEREST_RATE = 5n * 10n ** 15n;
export const MAX_ANNUAL_INTEREST_RATE = 25n * 10n ** 17n;
export const GAS_COMPENSATION = 37_500_000_000_000_000n;

export const CONTRACTS = {
  spyToken: '0x9161834391C40fF0b04F07458F8F54035D35e959',
  spyChainlinkAggregator: '0xE18730F3c747643A2d67e84F89b531Ee0A4B316E',
  metadataNft: '0x25CB86b917d964Ee0B635daE02b714BA904d4943',
  base: '0x6c0f8353d8a1ecff893f998fdd3a9a0dce134180',
  boldToken: '0x1328e8d56b6398d7c912c20f0f8370713d53e69b',
  collateralRegistry: '0xb1a26065c225b8da5531cb7554b3d1ae7de1caaa',
  hintHelpers: '0xd71e65d1eaacd24e44567c3b59acc140bd6f2b24',
  multiTroveGetter: '0xc17266fe4575583853c1847afa734300417471cf',
  activePool: '0x0199ac3dab3ead0784d7dd26c006321d04a22d88',
  borrowerOperations: '0xe66d502446af8abc3697a3998df06c08d06a8a59',
  collSurplusPool: '0xc496d65346fd466603ef2a67b006b0b4681dfe98',
  defaultPool: '0x1ef7fda8c93c0391a49c536257cab4d21653d22e',
  gasPool: '0xea0ee9d2b84319cd25a951dfc17d0af64d00fcf0',
  sortedTroves: '0x42b12fbbd15cf6c814a904f6c1d22c4c5eb1ae2e',
  stabilityPool: '0xf7270e3774e8a8b2ec75dc165889b386dfe4c4ff',
  troveManager: '0x6bfc876468151ec30ca87f4fc512ca7953280b33',
  troveNft: '0xee030a4733956d413c286716f51e85ff4ec83171',
  spyPriceFeed: '0x06C5B78ce89Ab614aD07E9fe8C9135f2e5f0C82c',
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
  'function openTrove(address owner, uint256 ownerIndex, uint256 collAmount, uint256 boldAmount, uint256 upperHint, uint256 lowerHint, uint256 annualInterestRate, uint256 maxUpfrontFee, address addManager, address removeManager, address receiver) returns (uint256 troveId)',
]);

export const priceFeedAbi = parseAbi([
  'function lastGoodPrice() view returns (uint256)',
]);

export function maxUpfrontFee(predictedFee: bigint): bigint {
  if (predictedFee === 0n) return 0n;
  return predictedFee + predictedFee / 10n + 1n;
}

export function requiredSpyApproval(collateral: bigint): bigint {
  return collateral + GAS_COMPENSATION;
}

export function validateOpenTrove(
  collateral: bigint,
  borrowed: bigint,
  annualInterestRate: bigint,
): string | null {
  if (collateral <= 0n) return 'Enter SPY collateral.';
  if (borrowed < MIN_DEBT) return 'Borrow at least 2,000 BOLD.';
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
