import type { Metadata } from 'next';
import { StabilityPool } from '../../components/stability-pool';

export const metadata: Metadata = { title: 'Earn — Florin' };

export default function StabilityPage() {
  return <StabilityPool />;
}
