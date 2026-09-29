import type { Metadata } from 'next';
import { StabilityPool } from '../../components/stability-pool';
import { fetchFlorinMarkets } from '../../lib/florin-graph';

export const metadata: Metadata = { title: 'Earn — Florin' };

export default async function StabilityPage() {
  const markets = await fetchFlorinMarkets();
  return <StabilityPool initialMarkets={markets} />;
}
