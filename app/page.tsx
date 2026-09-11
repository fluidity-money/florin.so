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

      {/* Two things you can do. Filled, arrowed, and they lift on hover. */}
      <div className="home-action-grid">
        <Link href="/open" className="card home-action">
          <span className="card__row">
            <span className="card__title">Deposit</span>
            <span className="card__arrow">→</span>
          </span>
          <span className="card__body">SPY as collateral, and mint FUSD against it</span>
        </Link>

        <Link href="/stability" className="card home-action">
          <span className="card__row">
            <span className="card__title">Earn</span>
            <span className="card__arrow">→</span>
          </span>
          <span className="card__body">
            Back the pool that settles liquidations
            <span className="card__sub">
              Earns a share of borrower interest, paid in FUSD.
            </span>
          </span>
        </Link>
      </div>

      {/* Two things that are true. Outlined, no arrow, no hover: nothing to click. */}
      <div className="home-info-grid">
        <aside className="home-info">
          <p className="home-info__title">Lever your SPY exposure</p>
          <p className="home-info__body">
            Mint FUSD, buy more SPY, redeposit, repeat. Every round is smaller
            than the last, so the position settles rather than running away.
          </p>
        </aside>

        <aside className="home-info">
          <p className="home-info__title">Borrow without selling</p>
          <p className="home-info__body">Keep the dividends and keep the upside.</p>
        </aside>
      </div>

      <section className="tvl home-compact-tvl">
        <span className="tvl__label">total value locked</span>
        <span className="tvl__value">${money(tvlUsd, 0)}</span>
        <span className="tvl__note">
          <span>{int(PROTOCOL_STATS.spyLocked)} SPY · ${int(spyLockedUsd)} collateral</span>
          <span className="tvl-note__pool">${int(PROTOCOL_STATS.stabilityPoolUsd)} pool</span>
        </span>
      </section>

      <p className="home-risk-note">
        Borrowing here carries liquidation, redemption and collateral-freeze
        risk. <Link href="/risks">Read what can go wrong</Link> before you open a
        position.
      </p>
    </div>
  );
}
