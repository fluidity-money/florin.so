import type { Metadata } from 'next';
import { Overline } from '../../components/ui';
import { StabilityPool } from '../../components/stability-pool';

export const metadata: Metadata = { title: 'Stability pool — Florin' };

export default function StabilityPage() {
  return (
    <>
      <Overline>stability</Overline>
      <h1 className="page-title">Stability pool</h1>
      <p className="lead">
        Deposit FUSD into the pool to earn the protocol&apos;s stability fee as yield. Mocked.
      </p>
      <StabilityPool />
    </>
  );
}