import type { Metadata } from 'next';
import { ManagePosition } from '../../components/manage-position';
import { fetchFlorinMarkets } from '../../lib/florin-graph';
import { parseDisplayPercent } from '../../lib/florin-markets';

export const metadata: Metadata = { title: 'Manage position — Florin' };

// No page header: the component carries its own title, matching /open and
// /stability.
export default async function PositionPage() {
  const markets = await fetchFlorinMarkets();
  const marketAverageRate = parseDisplayPercent(markets.borrowDetails[0]?.avgRatePa);
  return <ManagePosition marketAverageRate={marketAverageRate} />;
}
