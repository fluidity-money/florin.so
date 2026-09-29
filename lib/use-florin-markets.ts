'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FLORIN_GRAPH_URL, MARKET_QUERY } from './florin-market-query';
import { hasMarketData, isFlorinMarkets, type FlorinMarkets } from './florin-markets';

const STORAGE_KEY = 'florin-markets-v1';
const QUERY_KEY = ['florin-markets'] as const;

async function fetchMarkets(): Promise<FlorinMarkets> {
  const response = await fetch(FLORIN_GRAPH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: MARKET_QUERY }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Florin GraphQL returned HTTP ${response.status}`);

  const payload: unknown = await response.json();
  if (
    !payload
    || typeof payload !== 'object'
    || !('data' in payload)
    || !isFlorinMarkets(payload.data)
  ) {
    throw new Error('Florin GraphQL returned invalid market data');
  }
  return payload.data;
}

export function useFlorinMarkets(initialData: FlorinMarkets): FlorinMarkets {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchMarkets,
    initialData,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  // Use a persisted last-known-good value only when SSR had no event-backed
  // data. All consumers share the React Query key, so this seeds one cache and
  // does not create independent polling loops.
  useEffect(() => {
    if (hasMarketData(query.data)) return;
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (isFlorinMarkets(parsed) && hasMarketData(parsed)) {
        queryClient.setQueryData(QUERY_KEY, parsed);
      }
    } catch {
      // Missing or invalid cached data is equivalent to no fallback.
    }
  }, [query.data, queryClient]);

  useEffect(() => {
    if (!hasMarketData(query.data)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(query.data));
    } catch {
      // Storage may be unavailable; live data remains usable in memory.
    }
  }, [query.data]);

  return query.data;
}
