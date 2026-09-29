import { parseAbi, type Address } from 'viem';

export const ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
export const TOKEN_DECIMALS = 18;
export const MIN_DEBT = 10n * 10n ** 18n;
export const MIN_ANNUAL_INTEREST_RATE = 5n * 10n ** 15n;
export const MAX_ANNUAL_INTEREST_RATE = 25n * 10n ** 17n;
export const LIQUIDATOR_COMPENSATION_ETH = 37_500_000_000_000_000n;

export const CONTRACTS = {
  spyToken: '0xEa211c7b113fF27C9c80dcbAd1847Dd7689C9200',
  spyChainlinkAggregator: '0x78f183A12F9Eec11FF9503666a8D8694c707F1c5',
  metadataNft: '0x9C2813a0E185039FC1d05D2386C9a287275A3994',
  base: '0x95bef01290059c653b1872cc22747e02d3e35948',
  boldToken: '0x5019b8e5afa5f64e48e48696eec6c546984f7131',
  collateralRegistry: '0xa6d42d8b56315963e67dc253ef8173f1f2c3cd6f',
  hintHelpers: '0xea7a158f3d45f23ff11e999e329d4cda5beff3a4',
  multiTroveGetter: '0x80c64aa04f4f2b3b67c96b065dd6c1cf7187dcb4',
  activePool: '0x000786d49ff85eeffae93ed5be26b66743480e79',
  borrowerOperations: '0xe89e8cb7e84dd1b4460cf2a51b3f0b05ff952bb6',
  collSurplusPool: '0x75c8f3f604f53369f466ace98f06e84881a89b8e',
  defaultPool: '0x79804f3002bc21266e14afea8690f43646348ce6',
  gasPool: '0xd66732195c2db4be03df0cfa325a6648e3ea5afe',
  sortedTroves: '0xb88ab53c81c859a73f0810d7e6aea9769f51356c',
  stabilityPool: '0xb3bb9d5aec54c6a0306e2ef12614255573190c78',
  troveManager: '0x93c251ff1182f2285e42ce773f8f2e1d9a8fc8b6',
  troveNft: '0x0edabfd36c57555a85f1db1665bf8bef60f42f14',
  spyPriceFeed: '0x848219083e4377a02b8f89ffee386583905b8712',
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
