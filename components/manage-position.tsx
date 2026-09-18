'use client';
import { useState } from 'react';
import { Button, RatioBar } from './ui';
import { RisksDialog } from './risks-dialog';
import { Token, TokenIcon } from './token-icon';
import {
  metrics,
  MIN_COLLATERAL_RATIO,
  maxBorrowableFUSD,
  SAMPLE_POSITION,
  MOCK_WALLET,
  queueAhead,
  RATE_BOOK_TOTAL,
  AVG_RATE,
  MIN_RATE,
  MAX_RATE,
} from '../lib/mockData';
import { money, pct, xnum, compact } from '../lib/format';
import { useWallet } from './wallet/wallet';
import { useSpyPrice } from '../lib/use-spy-price';
import { canViewSamplePosition } from '../lib/position-access';

type CollMode = 'deposit' | 'withdraw';
type DebtMode = 'borrow' | 'repay';

function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <span className="seg" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={o.id === value ? 'seg__opt seg__opt--on' : 'seg__opt'}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function ManagePosition() {
  const w = useWallet();
  const { price: spyPrice } = useSpyPrice();
  const [collateral, setCollateral] = useState(SAMPLE_POSITION.collateralSPY);
  const [debt, setDebt] = useState(SAMPLE_POSITION.debtFUSD);
  const [rate, setRate] = useState(SAMPLE_POSITION.rate);
  const [hasClosed, setHasClosed] = useState(false);

  const [collMode, setCollMode] = useState<CollMode>('deposit');
  const [debtMode, setDebtMode] = useState<DebtMode>('repay');
  const [collStr, setCollStr] = useState('');
  const [debtStr, setDebtStr] = useState('');

  const m = metrics(collateral, debt, spyPrice);
  const cap = maxBorrowableFUSD(collateral, spyPrice);
  const freeUsd = Math.max(0, cap - debt);
  const ahead = queueAhead(rate) * RATE_BOOK_TOTAL;
  const closed = hasClosed || (collateral <= 0 && debt <= 0);
  const ltv = m.collateralUsd > 0 ? debt / m.collateralUsd : 0;

  const collAmt = Math.max(0, xnum(collStr));
  const debtAmt = Math.max(0, xnum(debtStr));

  // What the position becomes if this change is applied. Showing it beside the
  // current figure is the whole point of a manage screen: the question is never
  // "what is my ratio" but "what will it be if I do this".
  const nextCollateral =
    collMode === 'deposit' ? collateral + collAmt : Math.max(0, collateral - collAmt);
  const nextDebt = debtMode === 'borrow' ? debt + debtAmt : Math.max(0, debt - debtAmt);
  const preview = metrics(nextCollateral, nextDebt, spyPrice);
  const pending = collAmt > 0 || debtAmt > 0;

  const collMax = collMode === 'deposit' ? MOCK_WALLET.spy : collateral;
  const debtMax = debtMode === 'borrow' ? freeUsd : Math.min(debt, MOCK_WALLET.fusd);
  const collOver = collAmt > collMax + 1e-6;
  const debtOver = debtAmt > debtMax + 0.005;

  // Withdrawing or borrowing must not push the position under the floor.
  const wouldBreach =
    pending && nextDebt > 0 && preview.collateralRatio < MIN_COLLATERAL_RATIO;

  function applyCollateral() {
    if (!collAmt || collOver || wouldBreach) return;
    setCollateral(nextCollateral);
    setCollStr('');
  }
  function applyDebt() {
    if (!debtAmt || debtOver || wouldBreach) return;
    setDebt(nextDebt);
    setDebtStr('');
  }

  if (!canViewSamplePosition(w.address)) {
    return (
      <div className="swap">
        <h1 className="swap__title">
          <span>Your position</span>
        </h1>
        <div className="swap__done">
          <span className="swap__done-mark" aria-hidden="true">
            ○
          </span>
          <h2>No position found</h2>
          <p>
            {w.connected
              ? 'This address does not have an open Florin position.'
              : 'Connect a wallet to view and manage its position.'}
          </p>
          <a className="btn btn--primary" href="/open">
            Open position →
          </a>
        </div>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="swap">
        <h1 className="swap__title">
          <span>Position closed</span>
        </h1>
        <div className="swap__done">
          <span className="swap__done-mark" aria-hidden="true">
            ✓
          </span>
          <h2>Trove closed</h2>
          <p>All SPY reclaimed and FUSD repaid. Demo only, no transaction was sent.</p>
          <a className="btn btn--primary" href="/open">
            Open position →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Your</span>
        <span className="swap__pair">
          <TokenIcon symbol="SPY" size={30} />
          <span className="swap__tok">SPY</span>
        </span>
        <span>position</span>
      </h1>

      {/* Summary, in the same card as the pool on Earn */}
      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="SPY" size={30} />
            <span>
              <span className="pool__name">{money(collateral, 2)} SPY deposited</span>
              <span className="pool__tvl">
                worth <b>${money(m.collateralUsd)}</b>
              </span>
            </span>
          </div>
          <div className="pool__aprs">
            <span>
              LTV <b>{pct(ltv * 100, 1)}</b>
            </span>
            <span className="pool__apr-sub">
              <i className={`swap__dot swap__dot--${m.health}`} />
              {m.health}
            </span>
          </div>
        </div>
        <div className="pool__bar">
          <RatioBar
            ratioPct={m.collateralRatioPct}
            minPct={MIN_COLLATERAL_RATIO * 100}
            health={m.health}
          />
        </div>
        <div className="pool__foot">
          <span className="tok-row">
            Debt <b>${money(debt)}</b> <Token symbol="FUSD" size={16} />
          </span>
          <span className="tok-row">
            Free to borrow <b>${money(freeUsd)}</b>
          </span>
        </div>
      </div>

      <div className="swap__meta">
        <span>
          Liquidation price <b>${money(m.liquidationPriceUsd)}</b>
        </span>
        <span>
          SPY price <b>${money(spyPrice)}</b>
        </span>
      </div>
      <div className="swap__meta">
        <span>
          Interest <b>${money(debt * rate / 12)}</b> / mo
        </span>
        <span>
          Redeemable before you <b>{compact(ahead)}</b>
        </span>
      </div>

      {/* Collateral */}
      <div className="swap__field">
        <div className="swap__row">
          <span className="swap__label">Collateral</span>
          <Seg
            value={collMode}
            onChange={(v) => {
              setCollMode(v);
              setCollStr('');
            }}
            options={[
              { id: 'deposit', label: 'Deposit' },
              { id: 'withdraw', label: 'Withdraw' },
            ]}
          />
        </div>
        <div className="swap__row">
          <input
            className="swap__amount"
            inputMode="decimal"
            placeholder="0.00"
            value={collStr}
            onChange={(e) => setCollStr(e.target.value)}
            aria-label={`${collMode} SPY`}
          />
          <button
            type="button"
            className="swap__max"
            disabled={collMax <= 0}
            onClick={() => setCollStr(collMax > 0 ? collMax.toFixed(4) : '')}
          >
            Max
          </button>
          <span className="swap__pill">
            <Token symbol="SPY" size={18} />
          </span>
        </div>
        <span className="swap__usd">
          {collMode === 'deposit'
            ? `you hold ${money(MOCK_WALLET.spy, 2)} SPY`
            : `${money(collateral, 2)} SPY in the position`}
        </span>
      </div>
      {collOver && (
        <p className="swap__over">
          {collMode === 'deposit'
            ? `You hold ${money(MOCK_WALLET.spy, 2)} SPY.`
            : `Only ${money(collateral, 2)} SPY is in the position.`}
        </p>
      )}
      <Button
        variant={collMode === 'deposit' ? 'primary' : 'ghost'}
        disabled={!w.connected || collAmt <= 0 || collOver || wouldBreach}
        onClick={applyCollateral}
      >
        {collMode === 'deposit' ? 'Deposit SPY' : 'Withdraw SPY'}
      </Button>

      {/* Debt */}
      <div className="swap__field">
        <div className="swap__row">
          <span className="swap__label">Debt</span>
          <Seg
            value={debtMode}
            onChange={(v) => {
              setDebtMode(v);
              setDebtStr('');
            }}
            options={[
              { id: 'borrow', label: 'Borrow' },
              { id: 'repay', label: 'Repay' },
            ]}
          />
        </div>
        <div className="swap__row">
          <input
            className="swap__amount"
            inputMode="decimal"
            placeholder="0.00"
            value={debtStr}
            onChange={(e) => setDebtStr(e.target.value)}
            aria-label={`${debtMode} FUSD`}
          />
          <button
            type="button"
            className="swap__max"
            disabled={debtMax <= 0}
            onClick={() => setDebtStr(debtMax > 0 ? debtMax.toFixed(2) : '')}
          >
            Max
          </button>
          <span className="swap__pill">
            <Token symbol="FUSD" size={18} />
          </span>
        </div>
        <span className="swap__usd">
          {debtMode === 'borrow'
            ? `$${money(freeUsd)} free to borrow`
            : `you hold $${money(MOCK_WALLET.fusd)} FUSD · $${money(debt)} owed`}
        </span>
      </div>
      {debtOver && (
        <p className="swap__over">
          {debtMode === 'borrow'
            ? `$${money(freeUsd)} is the most you can draw against this collateral.`
            : `You can repay at most $${money(debtMax)}.`}
        </p>
      )}
      <Button
        variant={debtMode === 'repay' ? 'primary' : 'ghost'}
        disabled={!w.connected || debtAmt <= 0 || debtOver || wouldBreach}
        onClick={applyDebt}
      >
        {debtMode === 'borrow' ? 'Borrow FUSD' : 'Repay FUSD'}
      </Button>

      {/* What the pending change does, before it is applied */}
      {pending && (
        <div className={`swap__meta${wouldBreach ? ' swap__meta--bad' : ''}`}>
          <span>
            <i className={`swap__dot swap__dot--${wouldBreach ? 'liquidation' : preview.health}`} />
            After this change
          </span>
          <span>
            LTV <b>{pct((preview.collateralUsd > 0 ? nextDebt / preview.collateralUsd : 0) * 100, 1)}</b>
            <em> ({pct(preview.collateralRatioPct, 0)} CR)</em>
          </span>
        </div>
      )}
      {wouldBreach && (
        <p className="swap__over">
          That would put the position below {pct(MIN_COLLATERAL_RATIO * 100, 0)} and make it
          liquidatable straight away.
        </p>
      )}

      {/* Rate */}
      <div className="swap__field swap__field--rate">
        <div className="swap__row">
          <span className="swap__label">
            Your interest rate <em>(avg. {pct(AVG_RATE * 100, 2)})</em>
          </span>
        </div>
        <div className="swap__row">
          <span className="swap__amount swap__amount--rate">{pct(rate * 100, 2)}</span>
          <input
            className="slider swap__slider"
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
          ${money(debt * rate)} FUSD / year on the <b>${money(debt)}</b> you owe
        </span>
      </div>

      <details className="swap__note">
        <summary>Repricing is how you leave the redemption queue</summary>
        <p>
          Redemptions are filled from the cheapest troves first. Raising your
          rate costs more but moves troves cheaper than yours in front of you.
          Right now <b>{compact(ahead)}</b> of protocol debt sits ahead of you.
        </p>
      </details>

      <Button variant="danger" disabled={!w.connected} onClick={() => setHasClosed(true)}>
        Close position
      </Button>

      <RisksDialog label="What can take this position" />
    </div>
  );
}
