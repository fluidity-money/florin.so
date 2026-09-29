'use client';
import { useState } from 'react';
import { Button, RatioBar } from './ui';
import { RisksDialog } from './risks-dialog';
import { Token, TokenIcon } from './token-icon';
import { money, pct, xnum } from '../lib/format';
import { useWallet } from './wallet/wallet';
import { useSpyPrice } from '../lib/use-spy-price';
import { useOpenPositions } from '../lib/use-open-positions';
import type { FlorinPosition } from '../lib/florin-positions';
import { maxBorrowableFUSD, positionMetrics } from '../lib/protocol-math';
import { MAX_RATE, MIN_COLLATERAL_RATIO, MIN_RATE } from '../lib/protocol-constants';
import { useWalletBalances } from '../lib/use-wallet-balances';
import { parseDisplayPercent, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { useFlorinMarkets } from '../lib/use-florin-markets';

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

function PositionNotice({
  title,
  children,
  retry,
}: {
  title: string;
  children: React.ReactNode;
  retry?: () => void;
}) {
  return (
    <div className="swap">
      <h1 className="swap__title"><span>Your position</span></h1>
      <div className="swap__done">
        <span className="swap__done-mark" aria-hidden="true">○</span>
        <h2>{title}</h2>
        <p>{children}</p>
        {retry ? (
          <Button variant="primary" onClick={retry}>Try again</Button>
        ) : title === 'No position found' ? (
          <a className="btn btn--primary" href="/open">Open position →</a>
        ) : null}
      </div>
    </div>
  );
}

export function ManagePosition({ initialMarkets }: { initialMarkets: FlorinMarkets }) {
  const w = useWallet();
  const markets = useFlorinMarkets(initialMarkets);
  const { borrow: spyMarketDetails } = spyMarket(markets);
  const marketAverageRate = parseDisplayPercent(spyMarketDetails?.avgRatePa);
  const { status, positions, error, refresh } = useOpenPositions(w.address);
  const [selectedTroveId, setSelectedTroveId] = useState<string | null>(null);

  if (!w.connected || !w.address) {
    return (
      <PositionNotice title="No position found">
        Connect a wallet to view and manage its positions.
      </PositionNotice>
    );
  }
  if (status === 'idle' || status === 'loading') {
    return <PositionNotice title="Loading position">Looking up this wallet’s open positions…</PositionNotice>;
  }
  if (status === 'error') {
    return (
      <PositionNotice title="Unable to load position" retry={refresh}>
        Florin GraphQL could not load this wallet’s positions{error ? `: ${error}` : '.'}
      </PositionNotice>
    );
  }
  if (positions.length === 0) {
    return (
      <PositionNotice title="No position found">
        This address does not have an open Florin position.
      </PositionNotice>
    );
  }

  const position = positions.find(({ troveId }) => troveId === selectedTroveId) ?? positions[0];
  return (
    <PositionEditor
      key={position.troveId}
      position={position}
      positions={positions}
      onSelect={setSelectedTroveId}
      marketAverageRate={marketAverageRate}
    />
  );
}

function PositionEditor({
  position,
  positions,
  onSelect,
  marketAverageRate,
}: {
  position: FlorinPosition;
  positions: FlorinPosition[];
  onSelect: (troveId: string) => void;
  marketAverageRate: number | null;
}) {
  const w = useWallet();
  const balances = useWalletBalances(w.address);
  const { price: spyPrice, live: priceLive } = useSpyPrice();
  const priceReady = priceLive && spyPrice > 0;
  const collateral = position.collateralSPY;
  const debt = position.debtFUSD;
  const [rate, setRate] = useState(position.rate);

  const [collMode, setCollMode] = useState<CollMode>('deposit');
  const [debtMode, setDebtMode] = useState<DebtMode>('repay');
  const [collStr, setCollStr] = useState('');
  const [debtStr, setDebtStr] = useState('');

  const m = positionMetrics(collateral, debt, spyPrice);
  const cap = maxBorrowableFUSD(collateral, spyPrice);
  const freeUsd = priceReady ? Math.max(0, cap - debt) : 0;
  const ltv = m.collateralUsd > 0 ? debt / m.collateralUsd : 0;

  const collAmt = Math.max(0, xnum(collStr));
  const debtAmt = Math.max(0, xnum(debtStr));

  // What the position becomes if this change is applied. Showing it beside the
  // current figure is the whole point of a manage screen: the question is never
  // "what is my ratio" but "what will it be if I do this".
  const nextCollateral =
    collMode === 'deposit' ? collateral + collAmt : Math.max(0, collateral - collAmt);
  const nextDebt = debtMode === 'borrow' ? debt + debtAmt : Math.max(0, debt - debtAmt);
  const preview = positionMetrics(nextCollateral, nextDebt, spyPrice);
  const pending = collAmt > 0 || debtAmt > 0;

  const collMax = collMode === 'deposit' ? balances.spy : collateral;
  const debtMax = debtMode === 'borrow' ? (priceReady ? freeUsd : 0) : Math.min(debt, balances.fusd);
  const collOver = (collMode !== 'deposit' || (!balances.loading && !balances.error))
    && collAmt > collMax + 1e-6;
  const debtOver = (debtMode === 'borrow' ? priceReady : !balances.loading && !balances.error)
    && debtAmt > debtMax + 0.005;

  // Withdrawing or borrowing must not push the position under the floor.
  const wouldBreach =
    priceReady && pending && nextDebt > 0 && preview.collateralRatio < MIN_COLLATERAL_RATIO;


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

      {positions.length > 1 && (
        <label className="swap__field">
          <span className="swap__label">Position</span>
          <select
            className="swap__amount"
            value={position.troveId}
            onChange={(event) => onSelect(event.target.value)}
            aria-label="Open position"
          >
            {positions.map((candidate) => (
              <option key={candidate.troveId} value={candidate.troveId}>
                Trove #{candidate.troveId} · {money(candidate.collateralSPY, 2)} SPY · ${money(candidate.debtFUSD)} debt
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Summary, in the same card as the pool on Earn */}
      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="SPY" size={30} />
            <span>
              <span className="pool__name">{money(collateral, 2)} SPY deposited</span>
              <span className="pool__tvl">
                worth <b>{priceReady ? `$${money(m.collateralUsd)}` : '—'}</b>
              </span>
            </span>
          </div>
          <div className="pool__aprs">
            <span>
              LTV <b>{priceReady ? pct(ltv * 100, 1) : '—'}</b>
            </span>
            <span className="pool__apr-sub">
              {priceReady ? <><i className={`swap__dot swap__dot--${m.health}`} />{m.health}</> : 'oracle unavailable'}
            </span>
          </div>
        </div>
        <div className="pool__bar">
          {priceReady && (
            <RatioBar
              ratioPct={m.collateralRatioPct}
              minPct={MIN_COLLATERAL_RATIO * 100}
              health={m.health}
            />
          )}
        </div>
        <div className="pool__foot">
          <span className="tok-row">
            Debt <b>${money(debt)}</b> <Token symbol="FUSD" size={16} />
          </span>
          <span className="tok-row">
            Free to borrow <b>{priceReady ? `$${money(freeUsd)}` : '—'}</b>
          </span>
        </div>
      </div>

      <div className="swap__meta">
        <span>
          Liquidation price <b>{priceReady ? `$${money(m.liquidationPriceUsd)}` : '—'}</b>
        </span>
        <span>
          SPY price <b>{priceReady ? `$${money(spyPrice)}` : '—'}</b>
        </span>
      </div>
      <div className="swap__meta">
        <span>
          Interest <b>${money(debt * rate / 12)}</b> / mo
        </span>
        <span>
          Market average <b>{marketAverageRate === null ? '—' : pct(marketAverageRate * 100, 2)}</b>
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
            ? balances.loading || balances.error
              ? 'Wallet balance unavailable'
              : `you hold ${money(balances.spy, 2)} SPY`
            : `${money(collateral, 2)} SPY in the position`}
        </span>
      </div>
      {collOver && (
        <p className="swap__over">
          {collMode === 'deposit'
            ? `You hold ${money(balances.spy, 2)} SPY.`
            : `Only ${money(collateral, 2)} SPY is in the position.`}
        </p>
      )}
      <Button
        variant={collMode === 'deposit' ? 'primary' : 'ghost'}
        disabled
      >
        Position transactions coming soon
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
            ? priceReady ? `$${money(freeUsd)} free to borrow` : 'Oracle price unavailable'
            : balances.loading || balances.error
              ? 'Wallet balance unavailable'
              : `you hold $${money(balances.fusd)} FUSD · $${money(debt)} owed`}
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
        disabled
      >
        Position transactions coming soon
      </Button>

      {/* What the pending change does, before it is applied */}
      {pending && priceReady && (
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
            Your interest rate <em>(avg. {marketAverageRate === null ? '—' : pct(marketAverageRate * 100, 2)})</em>
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
        <summary>Interest rate and redemption order</summary>
        <p>
          Redemptions are filled from the cheapest troves first. Raising your
          rate costs more but moves troves cheaper than yours in front of you.
          Exact queue depth is not available from the current market API.
        </p>
      </details>

      <Button variant="danger" disabled>
        Position transactions coming soon
      </Button>

      <RisksDialog label="What can take this position" />
    </div>
  );
}
