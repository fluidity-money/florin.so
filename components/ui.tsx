import type { ReactNode } from 'react';

// Small black-and-white UI kit. No hooks — safe to render on the server.

export function Panel({
  title,
  kicker,
  actions,
  children,
  className = '',
}: {
  title?: string;
  kicker?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel__head">
          <div className="panel__title">
            {kicker && <span className="panel__kicker">{kicker}</span>}
            {title && <h2 className="panel__h">{title}</h2>}
          </div>
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className={`stat ${strong ? 'stat--strong' : ''}`}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  step = 1,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__input">
        <input
          className="field__in"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="field__suffix">{suffix}</span>}
      </span>
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function SliderField({
  label,
  value,
  display,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  display?: ReactNode;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="field field--slider">
      <span className="field__label">
        {label}
        {display && <span className="field__slider-val">{display}</span>}
      </span>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function RatioBar({
  ratioPct,
  minPct,
  health,
}: {
  ratioPct: number;
  minPct: number;
  health: 'healthy' | 'warning' | 'liquidation';
}) {
  const shown = Math.min(ratioPct, 400) / 400; // clamp bar to 400%
  const minAt = Math.min(minPct, 400) / 400;
  return (
    <div className={`ratiobar ratiobar--${health}`}>
      <div className="ratiobar__track">
        <div className="ratiobar__min" style={{ left: `${minAt * 100}%` }} />
        <div
          className="ratiobar__fill"
          style={{ width: `${shown * 100}%` }}
        />
      </div>
      <div className="ratiobar__scale">
        <span>0%</span>
        <span className="ratiobar__min-label" style={{ left: `${minAt * 100}%` }}>min {Math.round(minPct)}%</span>
        <span>400%</span>
      </div>
    </div>
  );
}

export function Table({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <table className="table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Tag({ children, tone = 'outline' }: { children: ReactNode; tone?: 'outline' | 'filled' | 'danger' }) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}

export function Overline({ children }: { children: ReactNode }) {
  return <div className="overline">{children}</div>;
}