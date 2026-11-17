import type { Metadata } from 'next';
import { SwapPage } from '../../components/swap-page';

// Unlisted while it is being tested: nothing in the site links here, and
// search engines are asked not to index it.
export const metadata: Metadata = {
  title: 'Swap — Florin',
  robots: { index: false, follow: false },
};

export default function Swap() {
  return <SwapPage />;
}
