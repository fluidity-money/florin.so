'use client';
import { useState } from 'react';
import { Panel, NumberField, Button, RatioBar, Stat } from './ui';
import { metrics, SPY_PRICE_USD, MIN_COLLATERAL_RATIO, MAX_DEBT_APR, maxBorrowableFUSD, collateralValueUSD } from '../lib/mockData';
import { money, pct, xnum } from '../lib/format';
import { useWallet } from './wallet/wallet';

export function OpenPositionForm() {
  const w = useWallet();
  const [spyStr, setSpyStr] = useState('0');
  const [debtStr, setDebtStr] = useState('0');

  const spy = Math.max(0, xnum(spyStr));
  const debt = Math.max(0, xnum(debtStr));
  const cap = maxBorrowableFUSD(spy);
  const clampedDebt = Math.min(debt, cap);
  const m = metrics(spy, clampedDebt);
  const collUsd = collateralValueUSD(spy);
  const monthlyFee = clampedDebt * (MAX_DEBT_APR / 12);
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
            hint={`market value ≈ $ ${money(collUsd, 0)} @ $ ${money(SPY_PRICE_USD)}/sh`}
          />

          <NumberField
            label="FUSD to borrow (mint)"
            value={debtStr}
            onChange={setDebtStr}
            suffix="FUSD"
            hint={`max borrowable ≈ $ ${money(cap, 0)} at ${Math.round(MIN_COLLATERAL_RATIO * 100)}% CR`}
          />

          <div className="rule" />

          <div className="kv">
            <dt>collateral value</dt>
            <dd>$ {money(collUsd)}</dd>
            <dt>debt</dt>
            <dd>$ {money(clampedDebt)}</dd>
            <dt>collateral ratio</dt>
            <dd>{pct(m.collateralRatioPct, 1)}</dd>
            {clampedDebt > 0 && (
              <>
                <dt>est. stability fee</dt>
                <dd>$ {money(monthlyFee)} / mo</dd>
              </>
            )}
          </div>

          <RatioBar ratioPct={m.collateralRatioPct} minPct={MIN_COLLATERAL_RATIO * 100} health={m.health} />

          <Button
            variant="primary"
            disabled={spy <= 0 || clampedDebt <= 0 || !w.connected}
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
          <Stat label="Debt" value={`$ ${money(clampedDebt)}`} sub="FUSD" />
        </div>
        <dl className="kv mt">
          <dt>minted FUSD</dt>
          <dd>$ {money(clampedDebt)}</dd>
          <dt>collateral ratio</dt>
          <dd>{pct(m.collateralRatioPct, 1)}</dd>
          <dt>health</dt>
          <dd>{m.health}</dd>
          <dt>liquidation below</dt>
          <dd>{pct(MIN_COLLATERAL_RATIO * 100, 0)} CR</dd>
        </dl>

        {minted ? (
          <div className="empty">
            <span className="empty__glyph">✓</span>
            <h3>FUSD minted (mock)</h3>
            <p>
              Demo only — no transaction was sent. <code className="mono">{clampedDebt.toFixed(0)}</code> FUSD
              minted against <code className="mono">{spy.toFixed(2)}</code> SPY. View the live Trove on the
              Manage screen.
            </p>
            <div className="row">
              <Button variant="ghost" onClick={() => setMinted(false)}>Edit</Button>
              <a className="btn btn--primary" href="/position">Go to Manage →</a>
            </div>
          </div>
        ) : (
          <p className="muted">Set your collateral and borrow amount on the left. The numbers here update live.</p>
        )}
      </Panel>
    </div>
  );
}