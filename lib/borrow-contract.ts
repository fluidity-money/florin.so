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
  spyChainlinkAggregator: '0x1B65392eE538D633784593063207Dc0e543643D9',
  metadataNft: '0x2775C73d34f51813F7503596E2dB739EbA48215a',
  base: '0xd3973bbfda4de4dc6db27ecfeb9ce902c13d588a',
  boldToken: '0x3f85a44f9d997666ad15de4f1c8151e6f1a62601',
  collateralRegistry: '0x4a6830f22a47df18df38ca917dc46645fc372d3a',
  hintHelpers: '0x9c287fa9de7ed1fc4bfbef06f8bde3828dda0cf4',
  multiTroveGetter: '0x9a668d572414209f4acd23ca30a2fa982616c962',
  activePool: '0xa82c1be7c4a3a9c52da7b2720e4e08fcde832d2a',
  borrowerOperations: '0xe7712f8b3caa2ac31119b8ff797f088ef9625e77',
  collSurplusPool: '0x786c425d235b6a8947928c2ec65c8d9aa789f235',
  defaultPool: '0x6d9bbb5a150fbf7735f5ed7142e5a64aff01fea0',
  gasPool: '0xb4c8811319c7792875587cb7b400cf65c2d578af',
  sortedTroves: '0x18cb00682029a1925be17e4e6cf56a2ddfc0eee4',
  stabilityPool: '0xd5ced6c2607fbf19b77ba6567dc1a10626286747',
  troveManager: '0xb5cfda5d23e81de4aa0821d6aab4d66191c4ddd6',
  troveNft: '0x74b4fdf4a7828f7ceba14cc5d2416427af278c93',
  spyPriceFeed: '0xbd1f2b9996a40c9e99d43a517370c2e0adca8831',
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
