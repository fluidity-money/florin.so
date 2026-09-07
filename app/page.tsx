import Link from 'next/link';
import { PROTOCOL_STATS, collateralValueUSD } from '../lib/mockData';
import { money, int } from '../lib/format';

export default function HomePage() {
  const spyLockedUsd = collateralValueUSD(PROTOCOL_STATS.spyLocked);
  const tvlUsd = spyLockedUsd + PROTOCOL_STATS.stabilityPoolUsd;

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__copy">
          <p className="hero__eyebrow">THE STOCK-BACKED DOLLAR</p>
          <h1 id="hero-title" className="hero__title">
            Borrow<br />without<br />selling.
          </h1>
          <p className="hero__lead">
            Deposit SPY and mint FUSD on Robinhood Chain. Keep your market exposure,
            let dividends compound, and unlock dollars without selling a share.
          </p>
          <Link href="/open" className="hero__cta">OPEN A POSITION <span>→</span></Link>
        </div>

        <div className="hero__art" aria-hidden="true">
          <div className="hero__orb hero__orb--one" />
          <div className="hero__orb hero__orb--two" />
          <span className="hero__mark" />
          <p className="hero__ticker">SPY / FUSD</p>
        </div>
      </section>

      <section className="home-actions" aria-label="Use Florin">
        <Link href="/open" className="story-card story-card--gold">
          <span className="story-card__visual">
            <span className="story-card__number">01</span>
            <span className="story-card__mini-mark" aria-hidden="true" />
          </span>
          <span className="story-card__title">Deposit SPY. Mint dollars.</span>
          <span className="story-card__body">Borrow FUSD against the S&amp;P 500 without giving up your position.</span>
          <span className="story-card__link">OPEN POSITION <b>→</b></span>
        </Link>

        <Link href="/open" className="story-card story-card--blue">
          <span className="story-card__visual">
            <span className="story-card__number">10×</span>
            <span className="story-card__word">EXPOSURE</span>
          </span>
          <span className="story-card__title">Keep more market exposure.</span>
          <span className="story-card__body">Use borrowed FUSD while your SPY collateral remains invested.</span>
          <span className="story-card__link">EXPLORE LEVERAGE <b>→</b></span>
        </Link>

        <Link href="/stability" className="story-card story-card--ink">
          <span className="story-card__visual">
            <span className="story-card__number">03</span>
            <span className="story-card__word">EARN</span>
          </span>
          <span className="story-card__title">Put FUSD to work.</span>
          <span className="story-card__body">Provide redemption liquidity and earn protocol stability fees.</span>
          <span className="story-card__link">STABILITY POOL <b>→</b></span>
        </Link>
      </section>

      <section className="home-tvl" aria-label="Protocol totals">
        <p>TOTAL VALUE LOCKED</p>
        <strong>${money(tvlUsd, 0)}</strong>
        <span>{int(PROTOCOL_STATS.spyLocked)} SPY locked · ${int(PROTOCOL_STATS.stabilityPoolUsd)} in the stability pool</span>
      </section>
    </div>
  );
}
