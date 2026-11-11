import type { Metadata } from 'next';
import { MultiplyForm } from '../../components/multiply-form';
import { fetchFlorinMarkets } from '../../lib/florin-graph';

export const metadata: Metadata = { title: 'Multiply SPY — Florin' };

// Market data carries the average interest rate the rate box compares against.
export default async function MultiplyPage() {
  const markets = await fetchFlorinMarkets();
  return <MultiplyForm initialMarkets={markets} />;
}
