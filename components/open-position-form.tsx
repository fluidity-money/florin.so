'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Panel, NumberField, SliderField, Button, RatioBar, Stat } from './ui';
import {
  metrics,
  MIN_COLLATERAL_RATIO,
  maxBorrowableFUSD,
  collateralValueUSD,
  debtAfterFee,
  queueAhead,
  ORIGINATION_FEE,
  MIN_DEBT_FUSD,
  MIN_RATE,
  MAX_RATE,
  DEFAULT_RATE,
} from '../lib/mockData';
import { money, pct, xnum } from '../lib/format';
import { useWallet } from './wallet/wallet';
import { useSpyPrice } from '../lib/use-spy-price';

export function OpenPositionForm() {
  const w = useWallet();
  const { price: spyPrice, live } = useSpyPrice();
  const [spyStr, setSpyStr] = useState('0');
  const [debtStr, setDebtStr] = useState('0');
  const [rate, setRate] = useState(DEFAULT_RATE);

  const spy = Math.max(0, xnum(spyStr));
  const borrow = Math.max(0, xnum(debtStr));
  const cap = maxBorrowableFUSD(spy, spyPrice);
  const clampedBorrow = Math.min(borrow, cap);

  // What you receive is `clampedBorrow`. What you owe is that plus the
  // one-time origination fee, and the ratio is measured against what you owe.
  const debt = debtAfterFee(clampedBorrow);
  const fee = debt - clampedBorrow;
  const m = metrics(spy, debt, spyPrice);
  const collUsd = collateralValueUSD(spy, spyPrice);
  const annualInterest = debt * rate;
  const ahead = queueAhead(rate);
  const belowFloor = debt > 0 && debt < MIN_DEBT_FUSD;
  const [minted, setMinted] = useState(false);

  return (
    <div className="grid grid-cols-2">
      <Panel title="Deposit & mint" kicker="step 1 — choose your trove">
        <div className="stack">
          <NumberField
            label="SPY collateral"
            value={spyStr}
            onChange={setSpyStr}
            suffix="SPY"
            hint={`market value ≈ $ ${money(collUsd, 0)} @ $ ${money(spyPrice)}/token · ${live ? 'live' : 'fallback'}`}
          />

          <NumberField
            label="FUSD to borrow (mint)"
            value={debtStr}
            onChange={setDebtStr}
            suffix="FUSD"
            hint={`max ≈ $ ${money(cap, 0)} at ${Math.round(MIN_COLLATERAL_RATIO * 100)}% CR · minimum $ ${money(MIN_DEBT_FUSD, 0)}`}
          />

          <div className="rule" />

          <SliderField
            label="Your interest rate"
            value={rate}
            display={<strong>{pct(rate * 100, 2)}</strong>}
            onChange={setRate}
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.0025}
          />
          <p className="muted">
            You choose what you pay. The rate is also your place in the
            redemption queue: cheaper troves are cashed out first when someone
            swaps FUSD back for collateral.{' '}
            <Link href="/risks">How redemption works</Link>
          </p>

          <div className="kv">
            <dt>you receive</dt>
            <dd>$ {money(clampedBorrow)} FUSD</dd>
            <dt>origination fee</dt>
            <dd>$ {money(fee)} ({pct(ORIGINATION_FEE * 100, 1)}, once)</dd>
            <dt>you owe</dt>
            <dd>
              <strong>$ {money(debt)}</strong>
            </dd>
            <dt>collateral ratio</dt>
            <dd>{pct(m.collateralRatioPct, 1)}</dd>
            {debt > 0 && (
              <>
                <dt>interest</dt>
                <dd>$ {money(annualInterest / 12)} / mo</dd>
                <dt>ahead of you in queue</dt>
                <dd>{pct(ahead * 100, 0)} of protocol debt</dd>
              </>
            )}
          </div>

          <RatioBar ratioPct={m.collateralRatioPct} minPct={MIN_COLLATERAL_RATIO * 100} health={m.health} />

          {belowFloor && (
            <p className="warn">
              Positions must carry at least $ {money(MIN_DEBT_FUSD, 0)} of debt.
            </p>
          )}

          <Button
            variant="primary"
            disabled={spy <= 0 || clampedBorrow <= 0 || belowFloor || !w.connected}
            onClick={() => setMinted(true)}
          >
            {w.connected ? 'Mint FUSD →' : 'Connect wallet to mint'}
          </Button>
          {!w.connected && <p className="muted mono">A wallet connection is the only real part here — connect (top right) to continue.</p>}
        </div>
      </Panel>

      <Panel title="Your position" kicker="live preview">
        <div className="grid grid-cols-2">
          <Stat label="Collateral" value={`${money(spy, 0)}`} sub="SPY" />
          <Stat label="Debt" value={`$ ${money(debt)}`} sub="FUSD owed" />
        </div>
        <dl className="kv mt">
          <dt>FUSD in hand</dt>
          <dd>$ {money(clampedBorrow)}</dd>
          <dt>your rate</dt>
          <dd>{pct(rate * 100, 2)} / yr</dd>
          <dt>collateral ratio</dt>
          <dd>{pct(m.collateralRatioPct, 1)}</dd>
          <dt>health</dt>
          <dd>{m.health}</dd>
          <dt>liquidation below</dt>
          <dd>$ {money(m.liquidationPriceUsd)} / SPY</dd>
        </dl>

        <p className="muted mt">
          Interest is a lien, not a monthly bill. Nothing leaves your wallet: the
          debt grows and you settle it when you repay or close. Your collateral
          is never touched by interest, and dividends compound into it, so the
          ratio drifts more slowly than the rate alone suggests.
        </p>

        {minted ? (
          <div className="empty">
            <span className="empty__glyph">✓</span>
            <h3>FUSD minted (mock)</h3>
            <p>
              Demo only — no transaction was sent. <code className="mono">{clampedBorrow.toFixed(0)}</code> FUSD
              minted against <code className="mono">{spy.toFixed(2)}</code> SPY at{' '}
              <code className="mono">{pct(rate * 100, 2)}</code>. View the live Trove on the
              Manage screen.
            </p>
            <div className="row">
              <Button variant="ghost" onClick={() => setMinted(false)}>Edit</Button>
              <a className="btn btn--primary" href="/position">Go to Manage →</a>
            </div>
          </div>
        ) : (
          <p className="muted">Set your collateral, borrow amount and rate on the left. The numbers here update live.</p>
        )}
      </Panel>
    </div>
  );
}
