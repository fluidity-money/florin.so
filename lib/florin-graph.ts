import 'server-only';

import { isFlorinMarkets, type FlorinMarkets } from './florin-markets';
import { FLORIN_GRAPH_URL, MARKET_QUERY } from './florin-market-query';

interface GraphResponse {
  data?: unknown;
  errors?: { message: string }[];
}

type FlorinFetchOptions = RequestInit & {
  next?: { revalidate: number };
};

async function queryFlorinMarkets(options: FlorinFetchOptions): Promise<FlorinMarkets> {
  const response = await fetch(FLORIN_GRAPH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: MARKET_QUERY }),
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Florin GraphQL returned HTTP ${response.status}`);
  }

  const result = (await response.json()) as GraphResponse;
  if (result.errors?.length) {
    throw new Error(result.errors.map(({ message }) => message).join('; '));
  }
  if (!isFlorinMarkets(result.data)) {
    throw new Error('Florin GraphQL returned invalid market data');
  }

  return result.data;
}

// Initial HTML uses Next's shared server data cache. A stale value can be served
// while the browser independently asks Florin GraphQL for the latest value.
export async function fetchFlorinMarkets(): Promise<FlorinMarkets> {
  try {
    return await queryFlorinMarkets({ next: { revalidate: 60 } });
  } catch (error) {
    console.error('Unable to load cached Florin market data:', error);
    return { borrowDetails: [], earnRewards: [] };
  }
}
