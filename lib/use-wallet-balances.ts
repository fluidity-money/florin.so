'use client';

import { useEffect, useState } from 'react';
import { formatUnits, type Address } from 'viem';
import { CONTRACTS, erc20Abi } from './borrow-contract';
import { robinhoodPublicClient } from './robinhood-client';

interface WalletBalances {
  spy: number;
  fusd: number;
  loading: boolean;
  error: boolean;
}

const EMPTY_BALANCES: WalletBalances = {
  spy: 0,
  fusd: 0,
  loading: false,
  error: false,
};

export function useWalletBalances(owner: string | null): WalletBalances {
  const [balances, setBalances] = useState<WalletBalances>(EMPTY_BALANCES);

  useEffect(() => {
    if (!owner) {
      setBalances(EMPTY_BALANCES);
      return;
    }

    let cancelled = false;
    const address = owner as Address;
    setBalances((current) => ({ ...current, loading: true, error: false }));

    Promise.all([
      robinhoodPublicClient.readContract({
        address: CONTRACTS.spyToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }),
      robinhoodPublicClient.readContract({
        address: CONTRACTS.boldToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }),
    ])
      .then(([spy, fusd]) => {
        if (cancelled) return;
        setBalances({
          spy: Number(formatUnits(spy, 18)),
          fusd: Number(formatUnits(fusd, 18)),
          loading: false,
          error: false,
        });
      })
      .catch(() => {
        if (!cancelled) setBalances({ ...EMPTY_BALANCES, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [owner]);

  return balances;
}
