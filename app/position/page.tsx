import type { Metadata } from 'next';
import { ManagePosition } from '../../components/manage-position';

export const metadata: Metadata = { title: 'Manage position — Florin' };

// No page header: the component carries its own title, matching /open and
// /stability.
export default function PositionPage() {
  return <ManagePosition />;
}
