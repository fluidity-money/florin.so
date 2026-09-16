'use client';
import { useState } from 'react';
import { Button } from './ui';
import { RisksDialog } from './risks-dialog';
import { Token, TokenIcon } from './token-icon';
import {
  PROTOCOL_STATS,
  stabilityPoolApr,
  MOCK_WALLET,
  SP_INTEREST_SHARE,
  MIN_COLLATERAL_RATIO,
  ANNUAL_INTEREST_FUSD,
} from '../lib/mockData';
import { money, pct, xnum, compact } from '../lib/format';
import { useWallet } from './wallet/wallet';

export function StabilityPool() {
  const w = useWallet();
  const [deposited, setDeposited] = useState(0);
  const [depStr, setDepStr] = useState('');

  const apr = stabilityPoolApr();
  const amt = Math.max(0, xnum(depStr));
  const pool = PROTOCOL_STATS.stabilityPoolUsd;
  const maxDeposit = Math.max(0, MOCK_WALLET.fusd - deposited);
  const overWallet = amt > maxDeposit + 0.005;

  // Pool against the debt it may have to absorb. A high APR means this is low:
  // the same interest split among fewer depositors, which is a warning rather
  // than a reward.
  const coverage = PROTOCOL_STATS.totalDebtUsd > 0 ? pool / PROTOCOL_STATS.totalDebtUsd : 0;
  const coverageRisk = coverage >= 0.5 ? 'ok' : coverage >= 0.25 ? 'medium' : 'high';

  // Your slice of the pool after this deposit, which is your slice of both the
  // interest and the next liquidation.
  const shareAfter = pool + amt > 0 ? (deposited + amt) / (pool + amt) : 0;

  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Deposit</span>
        <span className="swap__pair">
          <TokenIcon symbol="FUSD" size={30} />
          <span className="swap__tok">FUSD</span>
        </span>
        <span>to earn rewards</span>
      </h1>
      <p className="swap__sub">
        A FUSD deposit earns a share of the interest every borrower pays. It
        also settles liquidations: when a position goes under, your FUSD is
        burned and you are handed the seized SPY at a discount.
      </p>

      {/* The pool. One branch today; this is a list so a second is a row. */}
      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="SPY" size={30} />
            <span>
            <span className="pool__name">SPY Stability Pool</span>
            <span className="pool__tvl">
              TVL <b>{compact(pool)}</b> FUSD
            </span>
            </span>
          </div>
          <div className="pool__aprs">
            <span>
              APR <b>{apr > 0 ? pct(apr * 100) : '—'}</b>
            </span>
            <span className="pool__apr-sub">
              <i className={`swap__dot swap__dot--${coverageRisk}`} />
              covers {pct(coverage * 100, 0)} of debt
            </span>
          </div>
        </div>
        <div className="pool__foot">
          <span className="tok-row">
            Deposit <Token symbol="FUSD" size={16} />
          </span>
          <span className="tok-row">
            Rewards <Token symbol="FUSD" size={16} /> <Token symbol="SPY" size={16} />
          </span>
        </div>
      </div>

      {/* Deposit */}
      <div className="swap__field">
        <span className="swap__label">Your deposit</span>
        <div className="swap__row">
          <input
            className="swap__amount"
            inputMode="decimal"
            placeholder="0.00"
            value={depStr}
            onChange={(e) => setDepStr(e.target.value)}
            aria-label="FUSD to deposit"
          />
          <button
            type="button"
            className="swap__max"
            disabled={maxDeposit <= 0}
            onClick={() => setDepStr(maxDeposit > 0 ? maxDeposit.toFixed(2) : '')}
          >
            Max
          </button>
          <span className="swap__pill"><Token symbol="FUSD" size={18} /></span>
        </div>
        <span className="swap__usd">
          ${money(amt)}
          {deposited > 0 && <> · ${money(deposited)} already in</>}
        </span>
      </div>
      {overWallet && (
        <p className="swap__over">
          You hold ${money(MOCK_WALLET.fusd, 2)} FUSD, of which ${money(maxDeposit, 2)} is
          still free to deposit.
        </p>
      )}
      <div className="swap__meta">
        <span>
          You hold <b>${money(MOCK_WALLET.fusd, 2)}</b> FUSD
        </span>
        <span>
          Pool share after <b>{pct(shareAfter * 100, 2)}</b>
        </span>
      </div>
      <div className="swap__meta swap__meta--right">
        <span>
          Projected <b>${money((deposited + amt) * apr)}</b> / year
        </span>
      </div>

      <details className="swap__note">
        <summary>What the pool actually does</summary>
        <p>
          It clears positions that fall below {pct(MIN_COLLATERAL_RATIO * 100, 0)}. The
          pool burns the trove&apos;s debt and receives its collateral, and the
          difference is your compensation for absorbing it.
        </p>
        <p>
          It is <strong>not</strong> what holds FUSD at a dollar. That is
          redemption, a separate mechanism that swaps FUSD for collateral from
          the cheapest-rate troves.
        </p>
        <p>
          Rewards come from {pct(SP_INTEREST_SHARE * 100, 0)} of borrower interest,
          currently {compact(ANNUAL_INTEREST_FUSD * SP_INTEREST_SHARE)} a year across
          the pool, plus the discount on every liquidation.
        </p>
      </details>

      <Button
        variant="primary"
        disabled={!w.connected || amt <= 0 || overWallet}
        onClick={() => {
          setDeposited((d) => d + amt);
          setDepStr('');
        }}
      >
        {w.connected ? 'Deposit FUSD →' : 'Connect wallet to continue'}
      </Button>

      {deposited > 0 && (
        <Button variant="ghost" onClick={() => setDeposited(0)}>
          Withdraw all
        </Button>
      )}

      <RisksDialog label="A deposit can be converted to SPY" />
    </div>
  );
}
