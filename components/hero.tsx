'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { parseDisplayNumber, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { useFlorinMarkets } from '../lib/use-florin-markets';
import { useSpyPrice } from '../lib/use-spy-price';
import { compact } from '../lib/format';
import { captureEvent } from '../lib/analytics';
import { useFeature } from '../hooks/useFeature';

const FAUCET_INTRO_COOKIE = 'florin_faucet_intro_seen';
const FAUCET_INTRO_MAX_AGE = 60 * 60 * 24 * 365;

// Landing hero: one painted field, one sentence, two ways in.
//
// The image carries the whole page, so everything laid over it is kept
// deliberately plain: a badge, a headline, a line of copy, two buttons, and
// the protocol's three numbers along the foot. Anything more competes with
// the picture and none of it would win.
export function Hero({ markets }: { markets: FlorinMarkets }) {
  const liveMarkets = useFlorinMarkets(markets);
  const { borrow, earn } = spyMarket(liveMarkets);
  const { price: spyPrice, live: priceLive } = useSpyPrice();
  const [showFaucetIntro, setShowFaucetIntro] = useState(false);
  const showXFollowButton = useFeature('show-x-follow-button');

  useEffect(() => {
    const hasSeenFaucetIntro = document.cookie
      .split(';')
      .some((cookie) => cookie.trim().startsWith(`${FAUCET_INTRO_COOKIE}=`));

    if (hasSeenFaucetIntro) return;

    setShowFaucetIntro(true);
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${FAUCET_INTRO_COOKIE}=1; Path=/; Max-Age=${FAUCET_INTRO_MAX_AGE}; SameSite=Lax${secure}`;
  }, []);

  // All three read in dollars. FUSD is a dollar stablecoin so those two are a
  // relabel, but collateral is held in SPY and has to be priced: it waits for
  // the oracle rather than showing $0 while the feed is still loading.
  const depositedSpy = parseDisplayNumber(borrow?.deposited);
  const collateralUsd =
    depositedSpy !== null && priceLive && spyPrice > 0 ? depositedSpy * spyPrice : null;
  const debtUsd = parseDisplayNumber(borrow?.debtIssued);
  const poolUsd = parseDisplayNumber(earn?.poolSize);

  const stats: [string, string][] = [
    ['Collateral deposited', collateralUsd !== null ? compact(collateralUsd) : '—'],
    ['FUSD in circulation', debtUsd !== null ? compact(debtUsd) : '—'],
    ['Stability Pool', poolUsd !== null ? compact(poolUsd) : '—'],
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
          <div className="hero__cta-row">
            <Link
              href="/open"
              className="hero__btn hero__btn--solid"
              onClick={() => captureEvent('product_cta_clicked', { product: 'borrow', source: 'hero', destination: '/open' })}
            >
              Open position
            </Link>
            <Link
              href="/stability"
              className="hero__btn hero__btn--ghost"
              onClick={() => captureEvent('product_cta_clicked', { product: 'earn', source: 'hero', destination: '/stability' })}
            >
              Earn with FUSD
            </Link>
            <div className="hero__faucet">
              {showFaucetIntro && (
                <span className="hero__faucet-tip" role="status">
                  <span>Start your testnet journey here</span>
                  <button
                    className="hero__faucet-tip-close"
                    type="button"
                    aria-label="Dismiss faucet introduction"
                    onClick={() => {
                      captureEvent('faucet_intro_dismissed', { source: 'home_hero' });
                      setShowFaucetIntro(false);
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
              <Link
                href="https://faucet.florin.so"
                className="hero__btn hero__btn--faucet"
                onClick={() => {
                  captureEvent('faucet_link_clicked', {
                    source: 'home_hero',
                    intro_visible: showFaucetIntro,
                    destination_host: 'faucet.florin.so',
                  });
                  setShowFaucetIntro(false);
                }}
              >
                <span className="hero__btn-spark" aria-hidden="true">✦</span>
                Florin SPY Faucet
                <span className="hero__btn-arrow" aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
          {showXFollowButton && (
            <a
              href="https://x.com/florinprotocol"
              className="hero__btn hero__btn--ghost"
              target="_blank"
              rel="noreferrer"
              onClick={() => captureEvent('social_follow_clicked', { account: 'florinprotocol', source: 'home_hero' })}
            >
              Follow florinprotocol on X
            </a>
          )}
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
