import type { Metadata } from 'next';
import { ManagePosition } from '../../components/manage-position';
import { fetchFlorinMarkets } from '../../lib/florin-graph';

export const metadata: Metadata = { title: 'Manage position — Florin' };

// No page header: the component carries its own title, matching /open and
// /stability.
export default async function PositionPage({ searchParams }: {
  searchParams: Promise<{ position?: string | string[] }>;
}) {
  const { position } = await searchParams;
  const markets = await fetchFlorinMarkets();
  return <ManagePosition initialMarkets={markets} requestedPosition={position === undefined ? null : typeof position === 'string' ? position : ''} />;
}
