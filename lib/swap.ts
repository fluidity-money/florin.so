// Swap page: the pairs it offers, the pools behind them and the estimate it
// shows before a real quote exists. Every swap has FUSD on one side.
//
// The estimate is a preview only: SPY at the oracle price, the stablecoins
// at a dollar. The real amounts come from the pool quote, which the backend
// wires in later (the testnet mock exchange first, the Uniswap pools at
// mainnet). No imports here on purpose, so it can be tested on its own.

export type SwapAsset = 'SPY' | 'USDG' | 'frxUSD';
export type SwapToken = SwapAsset | 'FUSD';

export const SWAP_ASSETS: readonly SwapAsset[] = ['USDG', 'frxUSD', 'SPY'];

export const SLIPPAGE_OPTIONS = [0.001, 0.005, 0.01] as const;
export type Slippage = (typeof SLIPPAGE_OPTIONS)[number];

export interface SwapPool {
  id: string;
  pair: readonly [SwapToken, SwapToken];
  venue: 'Uniswap';
}

// One pool per pair FUSD trades against. Venue details (fee tier, TVL, APR,
// the add-liquidity link) arrive with the backend.
export const SWAP_POOLS: readonly SwapPool[] = [
  { id: 'fusd-usdg', pair: ['FUSD', 'USDG'], venue: 'Uniswap' },
  { id: 'fusd-frxusd', pair: ['FUSD', 'frxUSD'], venue: 'Uniswap' },
  { id: 'spy-fusd', pair: ['SPY', 'FUSD'], venue: 'Uniswap' },
];

export function poolFor(a: SwapToken, b: SwapToken): SwapPool | null {
  return SWAP_POOLS.find(({ pair }) => pair.includes(a) && pair.includes(b)) ?? null;
}

// Dollar value of one unit, for the preview.
export function usdPerUnit(token: SwapToken, spyPrice: number): number | null {
  if (token === 'SPY') return spyPrice > 0 ? spyPrice : null;
  return 1;
}

// What `amount` of `from` is worth in `to`, before pool fees and price impact.
export function estimateOutput(from: SwapToken, to: SwapToken, amount: number, spyPrice: number): number | null {
  if (!(amount > 0)) return null;
  const fromUsd = usdPerUnit(from, spyPrice);
  const toUsd = usdPerUnit(to, spyPrice);
  if (fromUsd === null || toUsd === null) return null;
  return (amount * fromUsd) / toUsd;
}

export function minimumReceived(output: number | null, slippage: Slippage): number | null {
  return output === null ? null : output * (1 - slippage);
}
