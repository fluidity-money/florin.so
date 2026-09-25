import Link from 'next/link';
import { Hero } from '../components/hero';
import { Markets } from '../components/markets';
import { RisksDialog } from '../components/risks-dialog';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <div className="home home--hero">
      <Hero />

      <div className="home-action-grid">
        <Link href="/open" className="card home-action">
          <span className="card__row">
            <span className="card__title">Borrow</span>
            <span className="card__arrow">→</span>
          </span>
          <span className="card__body">
            Mint FUSD against your collateral at whatever interest rate you want
          </span>
        </Link>

        <Link href="/stability" className="card home-action">
          <span className="card__row">
            <span className="card__title">Earn with FUSD</span>
            <span className="card__arrow">→</span>
          </span>
          <span className="card__body">
            Deposit FUSD to earn protocol revenues and liquidation proceeds
          </span>
        </Link>

        <div className="card home-action home-action--soon" aria-disabled="true">
          <span className="card__row">
            <span className="card__title">Multiply</span>
            <span className="card__soon">coming soon</span>
          </span>
          <span className="card__body">
            Increase your exposure to tokenized equities and their dividends with
            a single click
          </span>
        </div>
      </div>

      <Markets />

      <RisksDialog label="Before you borrow, read what can go wrong" />
    </div>
  );
}
