'use client';

import { useEffect, useState } from 'react';
import { SPY_PRICE_USD } from './mockData';

export interface SpyPrice {
  price: number;
  live: boolean; // false while loading, and if CoinGecko is unreachable
  change24h: number | null;
}

// Reads the live token price once per mount, falling back to the constant so
// every consumer always has a number to render. Nothing here blocks: the page
// paints with the fallback and swaps to live when it arrives.
export function useSpyPrice(): SpyPrice {
  const [state, setState] = useState<SpyPrice>({
    price: SPY_PRICE_USD,
    live: false,
    change24h: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/spy-price')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || typeof d?.usd !== 'number') return;
        setState({ price: d.usd, live: true, change24h: d.change24h ?? null });
      })
      .catch(() => {
        /* keep the fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
