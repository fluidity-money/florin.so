import type { Metadata } from 'next';
import { OpenPositionForm } from '../../components/open-position-form';
import { fetchFlorinMarkets } from '../../lib/florin-graph';

export const metadata: Metadata = { title: 'Open position — Florin' };

// No page header: the form carries its own title, and a second heading above
// it just said the same thing twice.
export default async function OpenPage() {
  const markets = await fetchFlorinMarkets();
  return <OpenPositionForm initialMarkets={markets} />;
}
