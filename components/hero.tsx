'use client';

import Link from 'next/link';
import { PROTOCOL_STATS, collateralValueUSD } from '../lib/mockData';
import { compact } from '../lib/format';
import { useSpyPrice } from '../lib/use-spy-price';

// Landing hero: one painted field, one sentence, two ways in.
//
// The image carries the whole page, so everything laid over it is kept
// deliberately plain: a badge, a headline, a line of copy, two buttons, and
// the protocol's three numbers along the foot. Anything more competes with
// the picture and none of it would win.
export function Hero() {
  const { price } = useSpyPrice();
  const collateralUsd = collateralValueUSD(PROTOCOL_STATS.spyLocked, price);

  const stats: [string, string][] = [
    ['Collateral deposited', compact(collateralUsd)],
    ['FUSD in circulation', compact(PROTOCOL_STATS.fusdSupply)],
    ['Stability Pool', compact(PROTOCOL_STATS.stabilityPoolUsd)],
  ];

  return (
    <section className="hero">
      {/* Decorative: the headline beside it already says what this is. */}
      <img className="hero__bg" src="/hero.webp" alt="" aria-hidden="true" />
      <div className="hero__scrim" aria-hidden="true" />

      <div className="hero__inner">
        <span className="hero__badge">
          Built on
          {/* alt carries the wordmark, so the badge still reads
              "Built on Robinhood Chain" to a screen reader. */}
          <img
            className="hero__badge-logo"
            src="/robinhood-chain.svg"
            alt="Robinhood Chain"
          />
        </span>
        <h1 className="hero__title">Never sell a share.</h1>
        <p className="hero__lead">
          Florin is a lending market for tokenized equities. Deposit SPY as
          collateral, mint FUSD, and borrow dollars without giving up your
          position or the dividends it pays.
        </p>
        <div className="hero__cta">
          <Link href="/open" className="hero__btn hero__btn--solid">
            Open position
          </Link>
          <Link href="/stability" className="hero__btn hero__btn--ghost">
            Earn with FUSD
          </Link>
        </div>
      </div>

      <div className="hero__stats">
        {stats.map(([label, value]) => (
          <div className="hero__stat" key={label}>
            <span className="hero__stat-label">{label}</span>
            <span className="hero__stat-value">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
