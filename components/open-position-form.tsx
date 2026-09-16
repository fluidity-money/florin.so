'use client';
import { useState } from 'react';
import { Button } from './ui';
import { RisksDialog } from './risks-dialog';
import { Token, TokenIcon } from './token-icon';
import {
  metrics,
  MIN_COLLATERAL_RATIO,
  maxBorrowableFUSD,
  collateralValueUSD,
  debtAfterFee,
  queueAhead,
  RATE_BOOK_TOTAL,
  AVG_RATE,
  ORIGINATION_FEE,
  MIN_DEBT_FUSD,
  MIN_RATE,
  MAX_RATE,
  DEFAULT_RATE,
} from '../lib/mockData';
import { money, pct, xnum, compact } from '../lib/format';
import { useWallet } from './wallet/wallet';
import { useSpyPrice } from '../lib/use-spy-price';

// Max LTV is the reciprocal of the minimum collateral ratio. The form speaks
// in LTV because that is the question a borrower actually asks ("how much can
// I get"), and shows the ratio alongside it since that is what the protocol
// and the liquidation rule are written in.
const MAX_LTV = 1 / MIN_COLLATERAL_RATIO;

export function OpenPositionForm() {
  const w = useWallet();
  const { price: spyPrice, live } = useSpyPrice();
  const [spyStr, setSpyStr] = useState('');
  const [debtStr, setDebtStr] = useState('');
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [minted, setMinted] = useState(false);

  const spy = Math.max(0, xnum(spyStr));
  const borrow = Math.max(0, xnum(debtStr));
  const cap = maxBorrowableFUSD(spy, spyPrice);
  const clampedBorrow = Math.min(borrow, cap);

  // You receive `clampedBorrow`; you owe that plus the one-time origination
  // fee, and every health figure is measured against what you owe.
  const debt = debtAfterFee(clampedBorrow);
  const fee = debt - clampedBorrow;
  const m = metrics(spy, debt, spyPrice);
  const collUsd = collateralValueUSD(spy, spyPrice);
  const ltv = collUsd > 0 ? debt / collUsd : 0;
  const annualInterest = debt * rate;
  const ahead = queueAhead(rate) * RATE_BOOK_TOTAL;
  const belowFloor = debt > 0 && debt < MIN_DEBT_FUSD;
  const overCap = borrow > cap + 0.005;
  const active = spy > 0 && debt > 0;

  const redemptionRisk = rate >= AVG_RATE ? 'low' : rate >= AVG_RATE * 0.6 ? 'medium' : 'high';

  // Green while there is room, amber sitting on the floor, red once you have
  // asked for more than the collateral allows. Without the last case the
  // clamp keeps the position legal and red would never appear at all.
  const liqRisk = overCap ? 'liquidation' : m.health;

  if (minted) {
    return (
      <div className="swap">
        <div className="swap__done">
          <span className="swap__done-mark" aria-hidden="true">
            ✓
          </span>
          <h2>FUSD minted</h2>
          <p>
            Demo only, no transaction was sent. {money(clampedBorrow, 0)} FUSD against{' '}
            {money(spy, 2)} SPY at {pct(rate * 100, 2)}.
          </p>
          <div className="row">
            <Button variant="ghost" onClick={() => setMinted(false)}>
              Back
            </Button>
            <a className="btn btn--primary" href="/position">
              Go to Manage →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Borrow</span>
        <span className="swap__pair">
          <TokenIcon symbol="FUSD" size={30} />
          <span className="swap__tok">FUSD</span>
        </span>
        <span>with</span>
        <span className="swap__pair">
          <TokenIcon symbol="SPY" size={30} />
          <span className="swap__tok">SPY</span>
        </span>
      </h1>

      {/* Collateral in */}
      <div className="swap__field">
        <span className="swap__label">Collateral</span>
        <div className="swap__row">
          <input
            className="swap__amount"
            inputMode="decimal"
            placeholder="0.00"
            value={spyStr}
            onChange={(e) => setSpyStr(e.target.value)}
            aria-label="SPY collateral"
          />
          <span className="swap__pill"><Token symbol="SPY" size={18} /></span>
        </div>
        <span className="swap__usd">${money(collUsd)}</span>
      </div>
      <div className="swap__meta">
        <span>
          SPY price <b>${money(spyPrice)}</b>{' '}
          <i className={live ? 'swap__dot swap__dot--ok' : 'swap__dot'} />
          {live ? 'live' : 'fallback'}
        </span>
        <span>
          Max LTV <b>{pct(MAX_LTV * 100, 1)}</b>
        </span>
      </div>

      {/* Loan out */}
      <div className="swap__field">
        <span className="swap__label">Loan</span>
        <div className="swap__row">
          <input
            className="swap__amount"
            inputMode="decimal"
            placeholder="0.00"
            value={debtStr}
            onChange={(e) => setDebtStr(e.target.value)}
            aria-label="FUSD to borrow"
          />
          <button
            type="button"
            className="swap__max"
            disabled={cap <= 0}
            onClick={() => setDebtStr(cap > 0 ? cap.toFixed(2) : '')}
          >
            Max
          </button>
          <span className="swap__pill"><Token symbol="FUSD" size={18} /></span>
        </div>
        <span className="swap__usd">
          ${money(clampedBorrow)}
          {clampedBorrow > 0 && (
            <>
              {' '}
              received · <b>${money(debt)}</b> owed after the{' '}
              {pct(ORIGINATION_FEE * 100, 1)} fee
            </>
          )}
        </span>
      </div>
      {overCap && (
        <p className="swap__over">
          Above the maximum for this collateral. {money(cap, 2)} FUSD is the most
          you can borrow against {money(spy, 2)} SPY at {pct(MAX_LTV * 100, 1)} LTV.
        </p>
      )}
      <div className="swap__meta">
        <span>
          <i className={`swap__dot swap__dot--${liqRisk}`} /> Liquidation risk
        </span>
        <span>
          Max borrow <b>{spy > 0 ? `$${money(cap, 2)}` : '−'}</b>
        </span>
      </div>
      <div className="swap__meta swap__meta--right">
        <span>
          Liquidation price <b>{active ? `$${money(m.liquidationPriceUsd)}` : '−'}</b>
        </span>
      </div>
      <div className="swap__meta swap__meta--right">
        <span>
          LTV <b>{active ? pct(ltv * 100, 1) : '−'}</b>
          {active && <em> ({pct(m.collateralRatioPct, 0)} CR)</em>}
        </span>
      </div>

      {/* Rate */}
      <div className="swap__field swap__field--rate">
        <div className="swap__row">
          <span className="swap__label">
            Set interest rate <em>(avg. {pct(AVG_RATE * 100, 2)})</em>
          </span>
        </div>
        <div className="swap__row">
          <span className="swap__amount swap__amount--rate">{pct(rate * 100, 2)}</span>
          <input
            className="swap__slider"
            type="range"
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.0025}
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            aria-label="Interest rate"
          />
        </div>
        <span className="swap__usd">
          ${money(annualInterest)} FUSD / year
          {active && <> on the <b>${money(debt)}</b> you owe</>}
        </span>
      </div>
      <div className="swap__meta">
        <span>
          <i className={`swap__dot swap__dot--${redemptionRisk}`} /> {redemptionRisk} redemption
          risk
        </span>
        <span>
          Redeemable before you <b>{compact(ahead)}</b>
        </span>
      </div>

      {/* Explainer, the one thing a first-time borrower will not guess */}
      <details className="swap__note">
        <summary>Redemptions in a nutshell</summary>
        <p>
          Redemptions hold FUSD at a dollar. Anyone can swap 1 FUSD for a dollar
          of collateral, and those swaps are filled from the cheapest troves
          first, so your rate is also your place in the queue.
        </p>
        <p>
          Being redeemed is not a liquidation and costs you nothing directly:
          your debt falls by the same amount your collateral does. What you lose
          is exposure, at a moment you did not pick. Raise your rate to move
          back in the queue.
        </p>
      </details>

      {belowFloor && (
        <p className="warn">Positions must carry at least ${money(MIN_DEBT_FUSD, 0)} of debt.</p>
      )}

      <Button
        variant="primary"
        disabled={!active || belowFloor || !w.connected}
        onClick={() => setMinted(true)}
      >
        {w.connected ? 'Mint FUSD →' : 'Connect wallet to continue'}
      </Button>

      <RisksDialog />
    </div>
  );
}
