import { fetchFlorinMarkets } from '../lib/florin-graph';
import { MarketsClient } from './markets-client';

// Render cached data into the initial HTML, then let the client refresh it and
// retain the last successful value for an offline/error fallback.
export async function Markets() {
  const initialData = await fetchFlorinMarkets();
  return <MarketsClient initialData={initialData} />;
}
