import type { Metadata } from 'next';
import { Overline } from '../../components/ui';
import { ManagePosition } from '../../components/manage-position';

export const metadata: Metadata = { title: 'Manage position — Florin' };

export default function PositionPage() {
  return (
    <>
      <Overline>manage</Overline>
      <h1 className="page-title">Manage your position</h1>
      <p className="lead">
        A live (mocked) Trove — add collateral, borrow or repay FUSD, or close it out.
      </p>
      <ManagePosition />
    </>
  );
}