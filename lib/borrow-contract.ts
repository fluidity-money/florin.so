import { parseAbi, type Address } from 'viem';

export const ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
export const TOKEN_DECIMALS = 18;
export const MIN_DEBT = 10n * 10n ** 18n;
export const MIN_ANNUAL_INTEREST_RATE = 5n * 10n ** 15n;
export const MAX_ANNUAL_INTEREST_RATE = 25n * 10n ** 17n;
export const LIQUIDATOR_COMPENSATION_ETH = 37_500_000_000_000_000n;

export const CONTRACTS = {
  spyToken: '0xb176FA7377B7AFe5f51627F69D09e5aa52D3c6f8',
  spyChainlinkAggregator: '0x9BbE1453e2c7A0E7f2d1188043599b1b660329d9',
  metadataNft: '0x7c54cb5c6529ffB59f355217036F2c1553F9c448',
  base: '0x980761bb65982aab79bdc7f23e59ebf27771b2b6',
  boldToken: '0xa9de3d4031b499477a75dad56b178fd492cccc4f',
  collateralRegistry: '0xcfa6117cdca527a48876c8b8541f3360ee144311',
  hintHelpers: '0x7146261c02374442df5c3540fe004365c942b847',
  multiTroveGetter: '0xbf1de5542d5905f411ab1dc597fd9420d8e0c487',
  activePool: '0x321d15d900ef1e57c487251d387b78ba7718a653',
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
