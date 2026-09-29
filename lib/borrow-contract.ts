import { parseAbi, type Address } from 'viem';

export const ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
export const TOKEN_DECIMALS = 18;
export const MIN_DEBT = 10n * 10n ** 18n;
export const MIN_ANNUAL_INTEREST_RATE = 5n * 10n ** 15n;
export const MAX_ANNUAL_INTEREST_RATE = 25n * 10n ** 17n;
export const LIQUIDATOR_COMPENSATION_WETH = 1_000_000_000_000_000n;

export const CONTRACTS = {
  spyToken: '0x2541F59c5e47cC36eE1368d0F8B96360791D708f',
  spyChainlinkAggregator: '0xEBb9A0c911100157D72267caADBA6bf29dA0eD92',
  metadataNft: '0x32b565eF0e3B00dff3c18E23E36f903bb54FEa61',
  base: '0x0814e4d204c9c61c265da5113779bf77d8038d0d',
  boldToken: '0xedf9b41837e4483271511ab709161b9db8c17bb1',
  collateralRegistry: '0x021444ce9725d4d8e3ad50fb3647cce75a625f90',
  hintHelpers: '0x6bd9c9c05dcf21c17d45a33baf6f840a57aacd30',
  multiTroveGetter: '0x819f60704798fc31ad8dacb52fb8f2fd96678b94',
  activePool: '0x3a896658cc2f148c398cf420b8f6fdcffd194eda',
  borrowerOperations: '0x20a52933ffa5e2a0f11a4cf9b6ee54d738a09dd2',
  collSurplusPool: '0x50f9a6220a3acae6c03949c79d27a2f3304a9775',
  defaultPool: '0x4c0e523df5ec6f258bfa8f452bc70de138ad7a6b',
  gasPool: '0xd586422af4ad16cbc868a075e578303c881e2a63',
  sortedTroves: '0x50bb405e5d09869346cdbeed0f0b3c4e0934ccdb',
  stabilityPool: '0xf272712ee53a49106a5d81d11cefc0cf408f1f7d',
  troveManager: '0xf7683ecd9342662d3c780291f32dec4a34ccbf02',
  troveNft: '0xb96cfd362e0d41a9c5c189b0c1ff12e2f4074af9',
  spyPriceFeed: '0x49b4d2a6a92f34653f81e5252146657e4abc72ee',
  weth: '0x7943e237c7F95DA44E0301572D358911207852Fa',
} as const satisfies Record<string, Address>;

export const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
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
]);

export const sortedTrovesAbi = parseAbi([
  'function size() view returns (uint256)',
  'function findInsertPosition(uint256 annualInterestRate, uint256 prevId, uint256 nextId) view returns (uint256 upperHint, uint256 lowerHint)',
]);

export const borrowerOperationsAbi = parseAbi([
  'function openTrove(address owner, uint256 ownerIndex, uint256 collAmount, uint256 boldAmount, uint256 upperHint, uint256 lowerHint, uint256 annualInterestRate, uint256 maxUpfrontFee, address addManager, address removeManager, address receiver) returns (uint256 troveId)',
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

export function requiredWethWrap(wethBalance: bigint): bigint {
  return wethBalance < LIQUIDATOR_COMPENSATION_WETH
    ? LIQUIDATOR_COMPENSATION_WETH - wethBalance
    : 0n;
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
