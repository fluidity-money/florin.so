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
        Connect a wallet to view and manage its Florin position.
      </p>
      <ManagePosition />
    </>
  );
}