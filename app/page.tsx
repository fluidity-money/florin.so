import Link from 'next/link';
import { Overline } from '../components/ui';
import { PROTOCOL_STATS, collateralValueUSD } from '../lib/mockData';
import { money, int } from '../lib/format';

export default function HomePage() {
  const spyLockedUsd = collateralValueUSD(PROTOCOL_STATS.spyLocked);
  const tvlUsd = spyLockedUsd + PROTOCOL_STATS.stabilityPoolUsd;

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
        <Link href="/open" className="card home-action home-action--gold">
          <span className="card__row">
            <span className="card__title">Deposit</span>
            <span className="card__arrow">→</span>
          </span>
          <span className="card__body">SPY and get FUSD collateral</span>
        </Link>

        <div className="card home-action home-action--blue home-action--disabled" aria-disabled="true">
          <span className="card__row">
            <span className="card__title">Leverage</span>
            <span className="card__arrow">Soon</span>
          </span>
          <span className="card__body">Your SPY exposure to 10 times</span>
        </div>

        <aside className="home-manifesto" aria-label="Florin principle">
          <span className="home-manifesto__mark" aria-hidden="true" />
          <p>Borrow<br />without<br />selling.</p>
        </aside>
      </div>

      <Link href="/stability" className="card card--wide home-action home-action--wide">
        <span className="card__row">
          <span className="card__title">Earn</span>
          <span className="card__arrow">→</span>
        </span>
        <span className="card__body">
          Dividends on SPY
          <span className="card__sub">
            They compound into your collateral — so your stocks grow while you borrow.
          </span>
        </span>
      </Link>

      <section className="tvl home-compact-tvl">
        <span className="tvl__label">total value locked</span>
        <span className="tvl__value">${money(tvlUsd, 0)}</span>
        <span className="tvl__note">
          <span>{int(PROTOCOL_STATS.spyLocked)} SPY · ${int(spyLockedUsd)} collateral</span>
          <span className="tvl-note__pool">${int(PROTOCOL_STATS.stabilityPoolUsd)} pool</span>
        </span>
      </section>
    </div>
  );
}
