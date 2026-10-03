'use client';

import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { CONTRACTS, priceFeedAbi, validatedOraclePrice } from './borrow-contract';
import { robinhoodPublicClient } from './robinhood-client';

export interface SpyPrice {
  price: number;
  live: boolean;
  change24h: number | null;
}

export function useSpyPrice(): SpyPrice {
  const [state, setState] = useState<SpyPrice>({
    price: 0,
    live: false,
    change24h: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const simulation = await robinhoodPublicClient.simulateContract({
          address: CONTRACTS.spyPriceFeed,
          abi: priceFeedAbi,
          functionName: 'fetchPrice',
        });
        const value = validatedOraclePrice(simulation.result);
        if (!cancelled) {
          setState({ price: Number(formatUnits(value, 18)), live: true, change24h: null });
        }
      } catch {
        if (!cancelled) setState((current) => ({ ...current, live: false }));
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return state;
}
