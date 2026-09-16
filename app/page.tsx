import Link from 'next/link';
import { Overline } from '../components/ui';
import { Markets } from '../components/markets';
import { RisksDialog } from '../components/risks-dialog';

export default function HomePage() {
  return (
    <div className="home home--compact">
      <Overline>florin protocol</Overline>

      <section className="home-pitch">
        <h1 className="page-title">Deposit SPY and mint FUSD.</h1>
        <p className="lead">
          Deposit SPY (SPDR S&amp;P 500 ETF TRUST) on Robinhood Chain. Mint FUSD.
          Borrow dollars without selling a share.
        </p>
        <p className="lead home-pitch__last">
          When dividends land they compound into your collateral, so your stocks
          grow while you borrow.
        </p>
      </section>

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
