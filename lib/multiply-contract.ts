import { parseAbi, zeroAddress, maxUint256, type Address, type PublicClient } from 'viem';

export const MULTIPLY_SLIPPAGE_BPS = 50n;
export const BPS = 10_000n;

// Robinhood testnet mocks. Explicit zero overrides disable Multiply.
export const CONTRACTS = {
  leverageZapper: (process.env.NEXT_PUBLIC_LEVERAGE_ZAPPER_ADDRESS || '0xf63a41A0C8fDB81704C92Ba39eAcfB11f8C3FD87') as Address,
  // Legacy QUOTER is an exchange override, never an ExchangeHelpersV2 address.
  exchange: (process.env.NEXT_PUBLIC_MULTIPLY_EXCHANGE_ADDRESS || process.env.NEXT_PUBLIC_MULTIPLY_QUOTER_ADDRESS || '0x6AfC499c52571F03272Fa6a4FBba0b73674f7f4c') as Address,
  // Informational only: leverage inherits gas compensation; do not call this separately.
  gasCompZapper: (process.env.NEXT_PUBLIC_GAS_COMP_ZAPPER_ADDRESS || '0x2Ce45DC74397aE3A5082cc822A9A978fd387429b') as Address,
} as const;

export function multiplyAmounts(
  deposit: bigint,
  multiplierTenths: number,
): { flashLoanAmount: bigint; totalCollateral: bigint } {
  return multiplyAmountsBps(deposit, multiplierTenths * 1_000);
}

// Same sizing in basis points of a multiple (10,000 is 1x), for a multiplier
// set from a liquidation price, which rarely lands on a tenth.
export function multiplyAmountsBps(
  deposit: bigint,
  multiplierBps: number,
): { flashLoanAmount: bigint; totalCollateral: bigint } {
  if (deposit <= 0n || !Number.isInteger(multiplierBps) || multiplierBps < 10_000) {
    return { flashLoanAmount: 0n, totalCollateral: 0n };
  }

  const flashLoanAmount = (deposit * BigInt(multiplierBps - 10_000)) / BPS;
  return { flashLoanAmount, totalCollateral: deposit + flashLoanAmount };
}

// The multiple that puts liquidation at `liquidationPrice`, before fees.
// Liquidation sits where collateral is worth MCR times the debt, and the debt
// is the flash-loaned share of the exposure, so (m - 1) / m = liq / (MCR * price).
export function multiplierForLiquidationPrice(liquidationPrice: number, price: number, mcr: number): number | null {
  if (!(price > 0) || !(mcr > 0) || !(liquidationPrice > 0)) return null;
  const share = liquidationPrice / (mcr * price);
  // At or past the limit there is no multiple. The margin also catches values
  // that float rounding leaves a hair under 1, which would mean a huge one.
  if (!(share < 1 - 1e-9)) return null;
  return 1 / (1 - share);
}

export function addMultiplySlippage(quotedInput: bigint): bigint {
  return (quotedInput * (BPS + MULTIPLY_SLIPPAGE_BPS) + BPS - 1n) / BPS;
}

export const mockExchangeAbi = parseAbi([
  'function collToken() view returns (address)',
  'function boldToken() view returns (address)',
  'function priceFeed() view returns (address)',
  'function priceScale() view returns (uint256)',
  'function oracleScale() view returns (uint256)',
]);
const aggregatorAbi = parseAbi([
  'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
]);
const balanceAbi = parseAbi(['function balanceOf(address) view returns (uint256)']);
type ReadClient = Pick<PublicClient, 'readContract' | 'getBlock' | 'getCode'>;
type Branch = { spyToken: Address; boldToken: Address; borrowerOperations: Address };
const sameAddress = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

/** Exact-input mock pricing: no AMM fees/impact, assumes FUSD = USD.
 * Match the contract's timestamp policy (no age limit, including market closures).
 * Pin reads to one block so reserves, scales and answer describe the same state.
 */
export async function quoteMultiply(client: ReadClient, exchange: Address, branch: Branch, output: bigint) {
  if (output <= 0n || output > maxUint256) throw new Error('Invalid flash loan amount.');
  const block = await client.getBlock();
  const blockNumber = block.number;
  const read = <N extends 'collToken' | 'boldToken' | 'priceFeed' | 'priceScale' | 'oracleScale'>(functionName: N) =>
    client.readContract({ address: exchange, abi: mockExchangeAbi, functionName, blockNumber });
  const [collToken, boldToken, priceFeed, priceScale, oracleScale] = await Promise.all([
    read('collToken'), read('boldToken'), read('priceFeed'), read('priceScale'), read('oracleScale'),
  ]);
  if (!sameAddress(collToken, branch.spyToken) || !sameAddress(boldToken, branch.boldToken)
    || priceFeed === zeroAddress || priceScale <= 0n || oracleScale <= 0n) {
    throw new Error('Mock exchange token or scale mismatch.');
  }
  const [round, spyBalance, boldBalance] = await Promise.all([
    client.readContract({ address: priceFeed, abi: aggregatorAbi, functionName: 'latestRoundData', blockNumber }),
    client.readContract({ address: collToken, abi: balanceAbi, functionName: 'balanceOf', args: [exchange], blockNumber }),
    client.readContract({ address: boldToken, abi: balanceAbi, functionName: 'balanceOf', args: [exchange], blockNumber }),
  ]);
  const [, answer, , updatedAt] = round;
  if (answer <= 0n || updatedAt === 0n || updatedAt > block.timestamp) throw new Error('Mock exchange oracle price is invalid.');
  const price = answer * priceScale;
  if (price > maxUint256) throw new Error('Mock exchange price overflows.');
  const quotedInput = (output * price + oracleScale - 1n) / oracleScale;
  const boldAmount = addMultiplySlippage(quotedInput);
  const swapOutput = boldAmount * oracleScale / price;
  if (boldAmount > maxUint256 || swapOutput > maxUint256) throw new Error('Multiply quote overflows.');
  // The loan is outstanding when swapFromBold pays out its entire padded output.
  if (spyBalance < output + swapOutput) throw new Error('Insufficient mock SPY liquidity for both flash loan and swap.');
  return { boldAmount, quotedInput, swapOutput, spyBalance, boldBalance, priceFeed, blockNumber };
}

export async function verifyMultiplyDeployment(client: ReadClient, zapper: Address, exchange: Address, branch: Branch) {
  const [zapperCode, exchangeCode, coll, bold, swap, lender, operations] = await Promise.all([
    client.getCode({ address: zapper }), client.getCode({ address: exchange }),
    ...(['collToken', 'boldToken', 'exchange', 'flashLoanProvider', 'borrowerOperations'] as const).map(functionName =>
      client.readContract({ address: zapper, abi: leverageZapperAbi, functionName })),
  ]);
  if (!zapperCode || zapperCode === '0x' || !exchangeCode || exchangeCode === '0x'
    || !sameAddress(coll, branch.spyToken) || !sameAddress(bold, branch.boldToken)
    || !sameAddress(swap, exchange) || !sameAddress(lender, exchange)
    || !sameAddress(operations, branch.borrowerOperations)) {
    throw new Error('Multiply deployment contracts could not be verified on Robinhood testnet.');
  }
}

export function isMultiplyCollateralSafe(collateral: bigint, oraclePrice: bigint, debt: bigint, feeCeiling: bigint): boolean {
  // SPY and FUSD use 18 decimals in this branch; MCR is 110%.
  return oraclePrice > 0n && debt > 0n && collateral * oraclePrice >= (debt + feeCeiling) * 1_100_000_000_000_000_000n;
}

export const leverageZapperAbi = [
  ...parseAbi(['function flashLoanProvider() view returns (address)', 'function borrowerOperations() view returns (address)']),
  {
    type: 'function',
    name: 'collToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'boldToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'exchange',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'openLeveragedTroveWithSPY',
    stateMutability: 'payable',
    inputs: [{
      name: '_params',
      type: 'tuple',
      components: [
        { name: 'owner', type: 'address' },
        { name: 'ownerIndex', type: 'uint256' },
        { name: 'collAmount', type: 'uint256' },
        { name: 'flashLoanAmount', type: 'uint256' },
        { name: 'boldAmount', type: 'uint256' },
        { name: 'upperHint', type: 'uint256' },
        { name: 'lowerHint', type: 'uint256' },
        { name: 'annualInterestRate', type: 'uint256' },
        { name: 'batchManager', type: 'address' },
        { name: 'maxUpfrontFee', type: 'uint256' },
        { name: 'addManager', type: 'address' },
        { name: 'removeManager', type: 'address' },
        { name: 'receiver', type: 'address' },
      ],
    }],
    outputs: [],
  },
] as const;
