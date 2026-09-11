'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Panel, Button, NumberField, Stat } from './ui';
import {
  PROTOCOL_STATS,
  stabilityPoolApr,
  MOCK_WALLET,
  SP_INTEREST_SHARE,
  MIN_COLLATERAL_RATIO,
} from '../lib/mockData';
import { money, pct, xnum, int } from '../lib/format';
import { useWallet } from './wallet/wallet';

export function StabilityPool() {
  const w = useWallet();
  const [deposited, setDeposited] = useState(0);
  const [depStr, setDepStr] = useState('0');

  const apr = stabilityPoolApr();
  const amt = Math.max(0, xnum(depStr));
  const annual = deposited * apr;
  const monthly = annual / 12;
  const maxDeposit = Math.max(0, MOCK_WALLET.fusd - deposited);

  // Pool size against the debt it may have to absorb. A high yield means this
  // is low: the same interest split among fewer depositors.
  const coverage =
    PROTOCOL_STATS.totalDebtUsd > 0
      ? PROTOCOL_STATS.stabilityPoolUsd / PROTOCOL_STATS.totalDebtUsd
      : 0;

  return (
    <div className="grid grid-cols-2">
      <Panel title="Pool" kicker="settles liquidations">
        <div className="grid grid-cols-2">
          <Stat label="Pool size" value={`$ ${int(PROTOCOL_STATS.stabilityPoolUsd)}`} sub="FUSD" strong />
          <Stat label="Yield" value={apr > 0 ? pct(apr * 100) : 'n/a'} sub={apr > 0 ? 'APR' : 'no pool yet'} />
        </div>
        <dl className="kv mt">
          <dt>pool role</dt>
          <dd>absorbs liquidated troves</dd>
          <dt>you are paid in</dt>
          <dd>seized SPY, at a discount</dd>
          <dt>plus</dt>
          <dd>{pct(SP_INTEREST_SHARE * 100, 0)} of borrower interest</dd>
          <dt>coverage</dt>
          <dd>{pct(coverage * 100, 0)} of protocol debt</dd>
          <dt>FUSD supply</dt>
          <dd>$ {int(PROTOCOL_STATS.fusdSupply)}</dd>
        </dl>
        <p className="muted mt">
          The pool is not what holds FUSD at a dollar. That is redemption, a
          separate mechanism that swaps FUSD for collateral from the
          cheapest-rate troves. The pool exists to clear positions that fall
          below {pct(MIN_COLLATERAL_RATIO * 100, 0)}.
        </p>
      </Panel>

      <Panel title="Your deposit" kicker={`connected ${w.short ?? 'n/a'}`}>
        <div className="grid grid-cols-2">
          <Stat label="Deposited" value={`$ ${money(deposited)}`} sub="FUSD" />
          <Stat label="Projected yield" value={`$ ${money(annual)}`} sub="per year" />
        </div>

        <div className="stack mt">
          <NumberField label="Amount" value={depStr} onChange={setDepStr} suffix="FUSD" hint={`you hold $ ${int(MOCK_WALLET.fusd)} FUSD · ${int(maxDeposit)} available to deposit`} />
          <Button variant="primary" disabled={!w.connected || amt <= 0 || amt > maxDeposit} onClick={() => setDeposited((d) => Math.min(MOCK_WALLET.fusd, d + amt))}>
            Deposit FUSD →
          </Button>
          <Button variant="ghost" disabled={!w.connected || deposited <= 0} onClick={() => setDeposited(0)}>
            Withdraw all
          </Button>
          <p className="muted mono mt">
            {deposited > 0
              ? `earning ≈ $ ${money(monthly)} / month (mock)`
              : 'Deposit FUSD to start earning a share of borrower interest.'}
          </p>
        </div>

        <div className="rule" />

        <p className="warn">
          This is not a savings account. When a trove is liquidated the pool
          burns FUSD deposits and hands you the seized SPY instead. You get it
          at a discount, which is where the return comes from, but you get it as
          equity right after the price fell, and you do not choose when.{' '}
          <Link href="/risks">What can go wrong</Link>
        </p>
      </Panel>
    </div>
  );
}
