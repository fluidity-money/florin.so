'use client';

import { useState } from 'react';
import { Button } from './ui';
import { Token, TokenIcon } from './token-icon';
import { TokenSelect } from './token-select';
import { useWallet } from './wallet/wallet';
import { useSpyPrice } from '../lib/use-spy-price';
import { useWalletBalances } from '../lib/use-wallet-balances';
import { money, xnum } from '../lib/format';
import {
  SLIPPAGE_OPTIONS,
  SWAP_ASSETS,
  SWAP_POOLS,
  estimateOutput,
  minimumReceived,
  poolFor,
  type Slippage,
  type SwapAsset,
  type SwapToken,
} from '../lib/swap';

// Swap into and out of FUSD, and provide liquidity to the pools behind it.
//
// Interface only for now: the amounts shown are a preview (SPY at the oracle
// price, stablecoins at a dollar) and the swap button stays disabled. The
// backend wires the pool quote and the swap and add-liquidity transactions
// in later. The page is unlisted: nothing in the site links here.

const SLIPPAGE_LABEL: Record<Slippage, string> = { 0.001: '0.1%', 0.005: '0.5%', 0.01: '1%' };

function decimalsFor(token: SwapToken): number {
  return token === 'SPY' ? 4 : 2;
}

function PairIcons({ pair }: { pair: readonly [SwapToken, SwapToken] }) {
  return (
    <span className="pair-icons" aria-hidden="true">
      <TokenIcon symbol={pair[0]} size={28} />
      <TokenIcon symbol={pair[1]} size={28} />
    </span>
  );
}

export function SwapPage() {
  const wallet = useWallet();
  const { price: spyPrice } = useSpyPrice();
  const balances = useWalletBalances(wallet.address);

  // `toFusd`: the chosen asset is paid and FUSD received. Flipping swaps the
  // two sides; the chosen asset stays the same.
  const [toFusd, setToFusd] = useState(true);
  const [asset, setAsset] = useState<SwapAsset>('USDG');
  const [amountStr, setAmountStr] = useState('');
  const [slippage, setSlippage] = useState<Slippage>(0.005);

  const from: SwapToken = toFusd ? asset : 'FUSD';
  const to: SwapToken = toFusd ? 'FUSD' : asset;
  const amount = Math.max(0, xnum(amountStr));
  const output = estimateOutput(from, to, amount, spyPrice);
  const minimum = minimumReceived(output, slippage);
  const pool = poolFor(from, to);
  const unitRate = estimateOutput(from, to, 1, spyPrice);

  // Wallet balances are only read for SPY and FUSD so far.
  const balanceOf = (token: SwapToken): string => {
    if (!wallet.connected) return 'wallet not connected';
    if (token === 'SPY') return `balance ${money(balances.spy, 4)} SPY`;
    if (token === 'FUSD') return `balance ${money(balances.fusd, 2)} FUSD`;
    return `balance — ${token}`;
  };

  const tokenControl = (side: 'pay' | 'receive') => {
    const token = side === 'pay' ? from : to;
    if (token === 'FUSD') {
      return <span className="swap__pill"><Token symbol="FUSD" size={18} /></span>;
    }
    return (
      <TokenSelect
        options={SWAP_ASSETS}
        value={asset}
        onChange={setAsset}
        label={side === 'pay' ? 'Token to pay' : 'Token to receive'}
      />
    );
  };

  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Swap</span>
        <span className="swap__pair">
          <TokenIcon symbol="FUSD" size={30} />
          <span className="swap__tok">FUSD</span>
        </span>
      </h1>

      <div className="swap__field">
        <span className="swap__label">You pay</span>
        <div className="swap__row">
          <input
            className="swap__amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amountStr}
            onChange={(event) => setAmountStr(event.target.value.replaceAll(',', ''))}
            aria-label={`${from} to pay`}
          />
          {tokenControl('pay')}
        </div>
        <span className="swap__usd">{balanceOf(from)}</span>
      </div>

      <div className="swap-flip">
        <button
          type="button"
          className="swap-flip__btn"
          aria-label={`Swap direction: pay ${to}, receive ${from}`}
          onClick={() => {
            setToFusd((was) => !was);
            setAmountStr(output !== null ? output.toFixed(decimalsFor(to)) : '');
          }}
        >
          <span aria-hidden="true">↓↑</span>
        </button>
      </div>

      <div className="swap__field swap__field--out">
        <span className="swap__label">You receive <em>(estimate)</em></span>
        <div className="swap__row">
          <span className="swap__amount swap__amount--out" aria-live="polite">
            {output !== null ? money(output, decimalsFor(to)) : '0.00'}
          </span>
          {tokenControl('receive')}
        </div>
        <span className="swap__usd">{balanceOf(to)}</span>
      </div>

      <dl className="swap-details">
        <div>
          <dt>Rate</dt>
          <dd>{unitRate !== null ? `1 ${from} ≈ ${money(unitRate, to === 'SPY' ? 6 : 2)} ${to}` : '—'}</dd>
        </div>
        <div>
          <dt>Route</dt>
          <dd>{pool ? `${pool.venue} · ${pool.pair.join(' / ')}` : '—'}</dd>
        </div>
        <div>
          <dt>Max slippage</dt>
          <dd>
            <span className="seg" role="group" aria-label="Maximum slippage">
              {SLIPPAGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === slippage ? 'seg__opt seg__opt--on' : 'seg__opt'}
                  aria-pressed={option === slippage}
                  onClick={() => setSlippage(option)}
                >
                  {SLIPPAGE_LABEL[option]}
                </button>
              ))}
            </span>
          </dd>
        </div>
        <div>
          <dt>Minimum received</dt>
          <dd>{minimum !== null ? `${money(minimum, decimalsFor(to))} ${to}` : '—'}</dd>
        </div>
      </dl>

      {wallet.connected ? (
        <Button variant="primary" disabled>Swaps open soon</Button>
      ) : (
        <Button variant="primary" onClick={() => void wallet.connect()}>Connect wallet</Button>
      )}
      <p className="mgmt__hint">
        The amounts shown are an estimate: SPY at the oracle price and stablecoins at a dollar,
        before pool fees and price impact. The swap itself uses the pool&rsquo;s live quote.
      </p>

      <section className="lp">
        <h2 className="lp__title">Provide liquidity</h2>
        <p className="mgmt__hint">Earn trading fees on the pools that route FUSD swaps.</p>
        {SWAP_POOLS.map((entry) => (
          <div className="pool" key={entry.id}>
            <div className="pool__head">
              <div className="pool__ident">
                <PairIcons pair={entry.pair} />
                <span>
                  <span className="pool__name">{entry.pair.join(' / ')}</span>
                  <span className="pool__tvl">{entry.venue}</span>
                </span>
              </div>
              <div className="pool__aprs">
                <span>APR <b>—</b></span>
                <span className="pool__apr-sub">TVL —</span>
              </div>
            </div>
            <div className="pool__foot lp__foot">
              <span>Fee tier —</span>
              <button type="button" className="lp__add" disabled>Add liquidity</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
