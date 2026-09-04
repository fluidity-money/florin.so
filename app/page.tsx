import Link from 'next/link';
import { Overline } from '../components/ui';
import { PROTOCOL_STATS, collateralValueUSD } from '../lib/mockData';
import { money, int } from '../lib/format';

export default function HomePage() {
  const spyLockedUsd = collateralValueUSD(PROTOCOL_STATS.spyLocked);
  const tvlUsd = spyLockedUsd + PROTOCOL_STATS.stabilityPoolUsd;

  return (
    <>
      <Overline>florin protocol</Overline>
      <h1 className="page-title">Mint FUSD by borrowing SPY</h1>
      <p className="lead">
        Deposit SPY (SPDR S&amp;P 500 ETF TRUST) on the Robinhood Chain. Mint FUSD. Borrow
        dollars without selling a share.
      </p>

      {/* Action cards */}
      <div className="grid grid-cols-2">
        <Link href="/open" className="card">
          <span className="card__row">
            <span className="card__title">Deposit</span>
            <span className="card__arrow">→</span>
          </span>
          <span className="card__body">SPY and get FUSD collateral</span>
        </Link>

        <Link href="/open" className="card">
          <span className="card__row">
            <span className="card__title">Leverage</span>
            <span className="card__arrow">→</span>
          </span>
          <span className="card__body">Your SPY exposure to 10 times</span>
        </Link>
      </div>

      <Link href="/stability" className="card card--wide">
        <span className="card__row">
          <span className="card__title">Earn</span>
          <span className="card__arrow">→</span>
        </span>
        <span className="card__body">
          Dividends on SPY
          <span className="card__sub">They compound into your collateral — so your stocks grow while you borrow.</span>
        </span>
      </Link>

      {/* TVL */}
      <section className="tvl">
        <span className="tvl__label">total value locked</span>
        <span className="tvl__value">$ {money(tvlUsd, 0)}</span>
        <span className="tvl__note">
          {int(PROTOCOL_STATS.spyLocked)} SPY locked ({int(spyLockedUsd)} collateral) · {int(PROTOCOL_STATS.stabilityPoolUsd)} in the stability pool
        </span>
      </section>
    </>
  );
}