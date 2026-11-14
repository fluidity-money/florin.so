'use client';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTS, priceFeedAbi } from './borrow-contract';
import { robinhoodPublicClient } from './robinhood-client';

// Whether the NYSE is closed right now, as the SPY price feed sees it. While
// it is, the protocol refuses new positions, extra borrowing and collateral
// withdrawals. False while unknown, so a failed read never blocks the page;
// the contract still enforces the rule.
export function useMarketClosed(): boolean {
  const query = useQuery({
    queryKey: ['spy-market-closed'],
    queryFn: () => robinhoodPublicClient.readContract({
      address: CONTRACTS.spyPriceFeed,
      abi: priceFeedAbi,
      functionName: 'isStockPaused',
    }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  return query.data === true;
}
