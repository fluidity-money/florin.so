'use client';

import { useState } from 'react';
import { money, xnum } from '../lib/format';
import { MIN_COLLATERAL_RATIO } from '../lib/protocol-constants';
import { LTV_RISK } from '../lib/protocol-math';
import { multiplierForLiquidationPrice } from '../lib/multiply-contract';

// Multiples in basis points: 10,000 is 1x. The slider moves in 0.1x steps.
export const MIN_MULTIPLIER_BPS = 11_000;
export const MAX_MULTIPLIER_BPS = 60_000;
const MULTIPLIER_STEP_BPS = 1_000;
const MULTIPLIER_TICKS = [11_000, 20_000, 30_000, 40_000, 50_000, 60_000];
export const MAX_LTV = 1 / MIN_COLLATERAL_RATIO;

// Where a multiple sits along the slider, as a percentage of its width.
function sliderPosition(bps: number): number {
  return ((bps - MIN_MULTIPLIER_BPS) / (MAX_MULTIPLIER_BPS - MIN_MULTIPLIER_BPS)) * 100;
}

// The multiple at which a given LTV is reached: LTV = (m - 1) / m.
function multipleAtLtv(ltv: number): number {
  return Math.round(10_000 / (1 - ltv));
}

// Green, then amber, then red along the track, changing colour where the
// liquidation risk bands change, so the slider says what the tag will say.
const TRACK_STOPS = (() => {
  const medium = Math.min(100, Math.max(0, sliderPosition(multipleAtLtv(LTV_RISK.medium * MAX_LTV))));
  const high = Math.min(100, Math.max(0, sliderPosition(multipleAtLtv(LTV_RISK.high * MAX_LTV))));
  return `linear-gradient(90deg, var(--risk-ok) 0%, var(--risk-ok) ${medium}%, var(--risk-warn) ${medium}%, var(--risk-warn) ${high}%, var(--risk-bad) ${high}%, var(--risk-bad) 100%)`;
})();

type SizeBy = 'multiplier' | 'liquidation';

// Sizing for a leveraged SPY position, shared by opening on Multiply and by
// changing leverage on Manage. The multiple is set either directly or from a
// target liquidation price; both drive the one slider. A liquidation price
// maps to a multiple the same way whether the position is new or existing,
// because both depend only on how much of the exposure is borrowed.
export function LeverageField({
  multiplierBps,
  onChange,
  spyPrice,
  liquidationPrice,
  disabled,
  minBps = MIN_MULTIPLIER_BPS,
  currentBps,
}: {
  multiplierBps: number;
  onChange: (bps: number) => void;
  spyPrice: number;
  liquidationPrice: number;
  disabled: boolean;
  minBps?: number;
  currentBps?: number | null;
}) {
  const [sizeBy, setSizeBy] = useState<SizeBy>('multiplier');
  // What the holder is typing into the liquidation price box. Null shows the
  // price the current multiple actually produces.
  const [liquidationDraft, setLiquidationDraft] = useState<string | null>(null);
  const multiplier = multiplierBps / 10_000;
  const floor = Math.max(MIN_MULTIPLIER_BPS, minBps);

  function setMultiple(bps: number) {
    onChange(Math.min(MAX_MULTIPLIER_BPS, Math.max(floor, Math.round(bps))));
  }

  function setLiquidationPrice(value: string) {
    setLiquidationDraft(value);
    const multiple = multiplierForLiquidationPrice(xnum(value), spyPrice, MIN_COLLATERAL_RATIO);
    if (multiple !== null) setMultiple(multiple * 10_000);
  }

  return (
    <div className="swap__field lev">
      <div className="swap__row">
        <span className="swap__label">{sizeBy === 'liquidation' ? 'Liquidation price' : 'Multiplier'}</span>
        <span className="seg" role="group" aria-label="Size the position by">
          {(['multiplier', 'liquidation'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={sizeBy === option ? 'seg__opt seg__opt--on' : 'seg__opt'}
              aria-pressed={sizeBy === option}
              onClick={() => {
                setSizeBy(option);
                setLiquidationDraft(null);
              }}
            >
              {option === 'liquidation' ? 'Liq. price' : 'Multiplier'}
            </button>
          ))}
        </span>
      </div>
      <div className="swap__row">
        {sizeBy === 'liquidation' ? (
          <span className="lev__price">
            <span aria-hidden="true">$</span>
            <input
              className="swap__amount"
              inputMode="decimal"
              placeholder="0.00"
              value={liquidationDraft ?? (liquidationPrice > 0 ? liquidationPrice.toFixed(2) : '')}
              onChange={(event) => setLiquidationPrice(event.target.value.replaceAll(',', ''))}
              onBlur={() => setLiquidationDraft(null)}
              disabled={disabled || !(spyPrice > 0)}
              aria-label="Liquidation price"
            />
          </span>
        ) : (
          <span className="swap__amount swap__amount--rate">{multiplier.toFixed(1)}x</span>
        )}
      </div>
      <div className="lev__slider">
        {/* Where the position stands today, when there is one. */}
        {currentBps != null && currentBps >= MIN_MULTIPLIER_BPS && currentBps <= MAX_MULTIPLIER_BPS && (
          <span
            className="lev__current"
            style={{ left: `calc(11px + (100% - 22px) * ${sliderPosition(currentBps) / 100})` }}
            title={`Current ${(currentBps / 10_000).toFixed(2)}x`}
            aria-hidden="true"
          />
        )}
        <input
          className="lev__range"
          type="range"
          min={MIN_MULTIPLIER_BPS}
          max={MAX_MULTIPLIER_BPS}
          step={MULTIPLIER_STEP_BPS}
          value={Math.round(multiplierBps / MULTIPLIER_STEP_BPS) * MULTIPLIER_STEP_BPS}
          onChange={(event) => {
            setLiquidationDraft(null);
            setMultiple(Number(event.target.value));
          }}
          disabled={disabled}
          style={{ '--lev-track': TRACK_STOPS } as React.CSSProperties}
          aria-label="Multiplier"
          aria-valuetext={`${multiplier.toFixed(2)}x`}
        />
        <div className="lev__ticks" aria-hidden="true">
          {MULTIPLIER_TICKS.map((tick) => (
            <span key={tick} style={{ left: `${sliderPosition(tick)}%` }}>{(tick / 10_000).toString()}x</span>
          ))}
        </div>
      </div>
      <div className="swap__row lev__foot">
        <span className="swap__usd">
          {sizeBy === 'liquidation'
            ? `Multiplier ${multiplier.toFixed(2)}x`
            : `Liquidation price ${liquidationPrice > 0 ? `$${money(liquidationPrice)}` : '−'}`}
        </span>
        <span className="swap__usd">SPY price {spyPrice > 0 ? `$${money(spyPrice)}` : '−'}</span>
      </div>
    </div>
  );
}
