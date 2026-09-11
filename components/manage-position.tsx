'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Panel, Button, NumberField, SliderField, RatioBar, Stat, Tag } from './ui';
import { metrics, MIN_COLLATERAL_RATIO, maxBorrowableFUSD, collateralValueUSD, SAMPLE_POSITION, MOCK_WALLET, queueAhead, MIN_RATE, MAX_RATE } from '../lib/mockData';
import { money, pct, xnum, int } from '../lib/format';
import { useWallet } from './wallet/wallet';
import { useSpyPrice } from '../lib/use-spy-price';
import { canViewSamplePosition } from '../lib/position-access';

export function ManagePosition() {
  const w = useWallet();
  const { price: spyPrice } = useSpyPrice();
  const [collateral, setCollateral] = useState(SAMPLE_POSITION.collateralSPY);
  const [debt, setDebt] = useState(SAMPLE_POSITION.debtFUSD);
  const [rate, setRate] = useState(SAMPLE_POSITION.rate);
  const [hasClosed, setHasClosed] = useState(false);

  const [depositSpy, setDepositSpy] = useState('0');
  const [withdrawSpy, setWithdrawSpy] = useState('0');
  const [borrowFusd, setBorrowFusd] = useState('0');
  const [repayFusd, setRepayFusd] = useState('0');

  const m = metrics(collateral, debt, spyPrice);
  const cap = maxBorrowableFUSD(collateral, spyPrice);
  const freeUsd = Math.max(0, cap - debt);
  const monthlyFee = debt * (rate / 12);
  const ahead = queueAhead(rate);
  const closed = hasClosed || (collateral <= 0 && debt <= 0);

  const dep = Math.max(0, xnum(depositSpy));
  const wd = Math.max(0, xnum(withdrawSpy));
  const br = Math.max(0, xnum(borrowFusd));
  const rp = Math.max(0, xnum(repayFusd));

  function doDeposit() {
    if (!dep) return;
    setCollateral((c) => c + Math.min(dep, MOCK_WALLET.spy));
  }
  function doWithdraw() {
    if (!wd) return;
    const nc = Math.max(0, collateral - wd);
    if (metrics(nc, debt, spyPrice).health === 'liquidation') return; // can't drop below min CR
    setCollateral(nc);
  }
  function doBorrow() {
    if (!br) return;
    setDebt((d) => d + Math.min(br, freeUsd));
  }
  function doRepay() {
    if (!rp) return;
    setDebt((d) => Math.max(0, d - rp));
  }
  function doClose() {
    setCollateral(0);
    setDebt(0);
    setHasClosed(true);
  }

  if (!canViewSamplePosition(w.address)) {
    return (
      <Panel title="Your trove" kicker={w.connected ? `connected ${w.short}` : 'wallet not connected'}>
        <div className="empty">
          <span className="empty__mark" aria-hidden="true" />
          <h3>No position found</h3>
          <p>This address does not have an open Florin position.</p>
          <a className="btn btn--primary" href="/open">Open position →</a>
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-2">
      {/* Current position */}
      <Panel
        title={closed ? 'Position closed' : 'Current position'}
        kicker="your trove"
        actions={closed ? undefined : <Tag tone={m.health === 'liquidation' ? 'danger' : m.health === 'warning' ? 'filled' : 'outline'}>{m.health}</Tag>}
      >
        {closed ? (
          <div className="empty">
            <span className="empty__mark" aria-hidden="true" />
            <h3>Trove closed</h3>
            <p>All SPY reclaimed and FUSD repaid (demo). Open a fresh position anytime.</p>
            <a className="btn btn--primary" href="/open">Open position →</a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2">
              <Stat label="Collateral" value={`${money(collateral, 2)}`} sub="SPY" strong />
              <Stat label="Debt" value={`$ ${money(debt)}`} sub="FUSD" />
            </div>
            <RatioBar ratioPct={m.collateralRatioPct} minPct={MIN_COLLATERAL_RATIO * 100} health={m.health} />
            <dl className="kv mt">
              <dt>collateral value</dt>
              <dd>$ {money(m.collateralUsd)}</dd>
              <dt>collateral ratio</dt>
              <dd>{pct(m.collateralRatioPct, 1)}</dd>
              <dt>liquidation below</dt>
              <dd>$ {money(m.liquidationPriceUsd)} / SPY</dd>
              <dt>free borrowing power</dt>
              <dd>$ {money(freeUsd)}</dd>
              <dt>your rate</dt>
              <dd>{pct(rate * 100, 2)} / yr</dd>
              <dt>interest</dt>
              <dd>$ {money(monthlyFee)} / mo</dd>
              <dt>ahead of you in queue</dt>
              <dd>{pct(ahead * 100, 0)} of protocol debt</dd>
            </dl>
            {m.health !== 'healthy' && (
              <p className="warn">
                {m.health === 'liquidation'
                  ? 'This Trove is below minimum collateral ratio and can be liquidated by the protocol.'
                  : 'This Trove is heading toward liquidation. Consider adding collateral or repaying FUSD.'}
              </p>
            )}
          </>
        )}
      </Panel>

      {/* Adjust */}
      <Panel title="Adjust position" kicker={w.connected ? `connected ${w.short}` : 'connect to adjust'}>
        <div className="stack">
          <NumberField label="Deposit SPY" value={depositSpy} onChange={setDepositSpy} suffix="SPY" hint={`you hold ${int(MOCK_WALLET.spy)} SPY`} />
          <Button variant="primary" disabled={!w.connected || dep <= 0} onClick={doDeposit}>Deposit SPY</Button>

          <div className="rule" />

          <NumberField label="Withdraw SPY" value={withdrawSpy} onChange={setWithdrawSpy} suffix="SPY" hint="cannot push CR below min" />
          <Button variant="ghost" disabled={!w.connected || wd <= 0 || closed} onClick={doWithdraw}>Withdraw SPY</Button>

          <div className="rule" />

          <NumberField label="Borrow more FUSD" value={borrowFusd} onChange={setBorrowFusd} suffix="FUSD" hint={`max $ ${money(freeUsd)}`} />
          <Button variant="ghost" disabled={!w.connected || br <= 0 || freeUsd <= 0} onClick={doBorrow}>Borrow FUSD</Button>

          <div className="rule" />

          <NumberField label="Repay FUSD" value={repayFusd} onChange={setRepayFusd} suffix="FUSD" hint={`you hold $ ${int(MOCK_WALLET.fusd)} FUSD`} />
          <Button variant="ghost" disabled={!w.connected || rp <= 0 || debt <= 0} onClick={doRepay}>Repay / burn FUSD</Button>

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
            Repricing is how you leave the redemption queue. Raising your rate
            costs more but moves troves cheaper than you in front.{' '}
            <Link href="/risks">Why that matters</Link>
          </p>

          <div className="rule" />

          <Button variant="danger" disabled={!w.connected || closed} onClick={doClose}>Close position</Button>
        </div>
      </Panel>
    </div>
  );
}