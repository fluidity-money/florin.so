'use client';

import { useState } from 'react';
import { Button } from './ui';
import { RisksDialog } from './risks-dialog';
import { Token, TokenIcon } from './token-icon';
import { parseDisplayPercent, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { money, xnum } from '../lib/format';
import { MIN_COLLATERAL_RATIO } from '../lib/protocol-constants';
import { useWalletBalances } from '../lib/use-wallet-balances';
import { useWallet } from './wallet/wallet';
import { useFlorinMarkets } from '../lib/use-florin-markets';

export function StabilityPool({ initialMarkets }: { initialMarkets: FlorinMarkets }) {
  const w = useWallet();
  const markets = useFlorinMarkets(initialMarkets);
  const { earn: rewards } = spyMarket(markets);
  const balances = useWalletBalances(w.address);
  const [depStr, setDepStr] = useState('');

  const amt = Math.max(0, xnum(depStr));
  const maxDeposit = balances.fusd;
  const overWallet = !balances.loading && !balances.error && amt > maxDeposit + 0.005;
  const coverage = parseDisplayPercent(rewards?.coverage);
  const coverageRisk = coverage === null
    ? 'high'
    : coverage >= 0.5
      ? 'ok'
      : coverage >= 0.25
        ? 'medium'
        : 'high';

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

      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="SPY" size={30} />
            <span>
              <span className="pool__name">SPY Stability Pool</span>
              <span className="pool__tvl">
                TVL <b>{rewards?.poolSize ?? '—'}</b> FUSD
              </span>
            </span>
          </div>
          <div className="pool__aprs">
            <span>APR <b>{rewards?.apr ?? '—'}</b></span>
            <span className="pool__apr-sub">
              <i className={`swap__dot swap__dot--${coverageRisk}`} />
              covers {rewards?.coverage ?? '—'} of FUSD supply
            </span>
          </div>
        </div>
        <div className="pool__foot">
          <span className="tok-row">Deposit <Token symbol="FUSD" size={16} /></span>
          <span className="tok-row">
            Rewards <Token symbol="FUSD" size={16} /> <Token symbol="SPY" size={16} />
          </span>
        </div>
      </div>

      <div className="swap__field">
        <span className="swap__label">Your deposit</span>
        <div className="swap__row">
          <input
            className="swap__amount"
            inputMode="decimal"
            placeholder="0.00"
            value={depStr}
            onChange={(event) => setDepStr(event.target.value)}
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
        <span className="swap__usd">${money(amt)}</span>
      </div>

      {overWallet && (
        <p className="swap__over">You hold ${money(balances.fusd, 2)} FUSD.</p>
      )}
      <div className="swap__meta">
        <span>
          You hold <b>{balances.loading ? 'loading…' : balances.error ? '—' : `$${money(balances.fusd, 2)}`}</b> FUSD
        </span>
        {balances.error && <span>Balance unavailable</span>}
      </div>

      <details className="swap__note">
        <summary>What the pool actually does</summary>
        <p>
          It clears positions that fall below {Math.round(MIN_COLLATERAL_RATIO * 100)}%. The
          pool burns the trove&apos;s debt and receives its collateral, and the
          difference is your compensation for absorbing it.
        </p>
        <p>
          It is <strong>not</strong> what holds FUSD at a dollar. That is
          redemption, a separate mechanism that swaps FUSD for collateral from
          the cheapest-rate troves.
        </p>
      </details>

      <Button variant="primary" disabled>
        Stability Pool transactions coming soon
      </Button>

      <RisksDialog label="A deposit can be converted to SPY" />
    </div>
  );
}
