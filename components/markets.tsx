import { fetchFlorinMarkets } from '../lib/florin-graph';
import type { FlorinMarkets } from '../lib/florin-markets';
import { MarketsClient } from './markets-client';

// Render cached data into the initial HTML, then let the client refresh it and
// retain the last successful value for an offline/error fallback.
export async function Markets({ initialData: providedData }: { initialData?: FlorinMarkets }) {
  const initialData = providedData ?? await fetchFlorinMarkets();
  return <MarketsClient initialData={initialData} />;
}
