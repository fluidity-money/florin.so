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
        The pool clears liquidated positions. Deposit FUSD, earn a share of
        borrower interest, and take on the seized SPY when a trove goes under.
        Mocked.
      </p>
      <StabilityPool />
    </>
  );
}