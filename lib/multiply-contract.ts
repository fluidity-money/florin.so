import type { Address } from 'viem';

export const MULTIPLY_SLIPPAGE_BPS = 50n;
export const BPS = 10_000n;

export const CONTRACTS = {
  leverageZapper: process.env.NEXT_PUBLIC_LEVERAGE_ZAPPER_ADDRESS as Address | undefined,
  exchangeHelpers: process.env.NEXT_PUBLIC_MULTIPLY_QUOTER_ADDRESS as Address | undefined,
} as const;

export function multiplyAmounts(
  deposit: bigint,
  multiplierTenths: number,
): { flashLoanAmount: bigint; totalCollateral: bigint } {
  if (deposit <= 0n || multiplierTenths < 10) {
    return { flashLoanAmount: 0n, totalCollateral: 0n };
  }

  const flashLoanAmount = (deposit * BigInt(multiplierTenths - 10)) / 10n;
  return { flashLoanAmount, totalCollateral: deposit + flashLoanAmount };
}

export function addMultiplySlippage(quotedInput: bigint): bigint {
  return (quotedInput * (BPS + MULTIPLY_SLIPPAGE_BPS) + BPS - 1n) / BPS;
}

export const exchangeHelpersAbi = [{
  type: 'function',
  name: 'quoteExactOutput',
  stateMutability: 'nonpayable',
  inputs: [
    { name: '_outputAmount', type: 'uint256' },
    { name: '_collToBold', type: 'bool' },
    { name: '_collToken', type: 'address' },
  ],
  outputs: [{ name: 'inputAmount', type: 'uint256' }],
}] as const;

export const leverageZapperAbi = [
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
    name: 'openLeveragedTroveWithRawETH',
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
