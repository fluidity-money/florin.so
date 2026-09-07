'use client';
import { useState } from 'react';
import { Panel, Button, NumberField, Stat } from './ui';
import { PROTOCOL_STATS, STABILITY_APR, MOCK_WALLET } from '../lib/mockData';
import { money, pct, xnum, int } from '../lib/format';
import { useWallet } from './wallet/wallet';

export function StabilityPool() {
  const w = useWallet();
  const [deposited, setDeposited] = useState(0);
  const [depStr, setDepStr] = useState('0');

  const amt = Math.max(0, xnum(depStr));
  const annual = deposited * STABILITY_APR;
  const monthly = annual / 12;
  const maxDeposit = Math.max(0, MOCK_WALLET.fusd - deposited);

  return (
    <div className="grid grid-cols-2">
      <Panel title="Pool" kicker="provide redemption liquidity">
        <div className="grid grid-cols-2">
          <Stat label="Pool size" value={`$ ${int(PROTOCOL_STATS.stabilityPoolUsd)}`} sub="FUSD" strong />
          <Stat label="Yield" value={pct(STABILITY_APR * 100)} sub="APR" />
        </div>
        <dl className="kv mt">
          <dt>pool role</dt>
          <dd>backs FUSD at $1 via redemption</dd>
          <dt>FUSD supply</dt>
          <dd>$ {int(PROTOCOL_STATS.fusdSupply)}</dd>
          <dt>reward source</dt>
          <dd>stability fees on open Troves</dd>
        </dl>
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
              : 'Deposit FUSD to start earning stability fee yield.'}
          </p>
        </div>
      </Panel>
    </div>
  );
}