'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FLORIN_GRAPH_URL, MARKET_QUERY } from './florin-market-query';
import { hasMarketData, isFlorinMarkets, type FlorinMarkets } from './florin-markets';

import { applyMarketReceipt, reconcileMarkets, withMarketCheckpoint, type MarketSnapshot, type MarketDelta, type MarketReceipt } from './market-adjustments';

const STORAGE_KEY = 'florin-markets-v1';
const QUERY_KEY = ['florin-markets'] as const;

async function fetchMarkets(): Promise<MarketSnapshot> {
  const response = await fetch(FLORIN_GRAPH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: MARKET_QUERY }),
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
  if ('errors' in payload && Array.isArray(payload.errors) && payload.errors.length) {
    throw new Error('Florin GraphQL returned partial market data');
  }
  return withMarketCheckpoint(payload.data, 'extensions' in payload ? payload.extensions : undefined);
}

export function useFlorinMarkets(initialData: FlorinMarkets): FlorinMarkets {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const incoming = await fetchMarkets();
      return reconcileMarkets(queryClient.getQueryData<MarketSnapshot>(QUERY_KEY), incoming);
    },
    initialData,
    gcTime: Infinity,
    staleTime: 60_000,
    // Render SSR data immediately, but always request the browser's own copy.
    refetchOnMount: 'always',
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
        queryClient.setQueryData(QUERY_KEY, withMarketCheckpoint(parsed, undefined));
      }
    } catch {
      // Missing or invalid cached data is equivalent to no fallback.
    }
  }, [query.data, queryClient]);

  useEffect(() => {
    if (!hasMarketData(query.data) || (query.data as MarketSnapshot).marketSync?.pending) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(query.data));
    } catch {
      // Storage may be unavailable; live data remains usable in memory.
    }
  }, [query.data]);

  return query.data;
}

// Call prepare before submitting a protocol action, and its returned callback
// only with that action's successful receipt (never an approval receipt).
export function useMarketAction() {
  const client = useQueryClient();
  return () => {
    const before = client.getQueryData<MarketSnapshot>(QUERY_KEY);
    return (receipt: MarketReceipt, delta: MarketDelta) => {
      client.setQueryData<MarketSnapshot>(QUERY_KEY, current => applyMarketReceipt(current, before, receipt, delta));
      void client.invalidateQueries({ queryKey: QUERY_KEY });
    };
  };
}
