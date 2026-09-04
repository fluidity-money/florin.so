import type { Metadata } from 'next';
import { Overline } from '../../components/ui';
import { OpenPositionForm } from '../../components/open-position-form';

export const metadata: Metadata = { title: 'Open position — Florin' };

export default function OpenPage() {
  return (
    <>
      <Overline>mint</Overline>
      <h1 className="page-title">Open a position</h1>
      <p className="lead">Deposit SPY collateral and borrow FUSD.</p>
      <OpenPositionForm />
    </>
  );
}