'use client';

import { useEffect, useRef, useState } from 'react';
import { Token, type TokenSymbol } from './token-icon';

// The token pill as a dropdown. It keeps the pill's look so a form reads the
// same whether a field offers one token or several, and opens the same menu
// the manage page uses to pick between positions.
export function TokenSelect<T extends TokenSymbol>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (symbol: T) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A pointer outside the menu, or Escape, closes it. Both listeners only
  // exist while it is open.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function step(delta: number) {
    const at = options.indexOf(value);
    onChange(options[(at + delta + options.length) % options.length]);
  }

  return (
    <div className="tok-select" ref={root}>
      <button
        type="button"
        className="swap__pill tok-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          step(event.key === 'ArrowDown' ? 1 : -1);
        }}
      >
        <Token symbol={value} size={18} />
        <span className="picker__chev tok-select__chev" aria-hidden="true" />
      </button>

      {open && (
        <ul className="picker__menu tok-select__menu" role="listbox" aria-label={label}>
          {options.map((symbol) => {
            const current = symbol === value;
            return (
              <li key={symbol}>
                <button
                  type="button"
                  role="option"
                  aria-selected={current}
                  className={current ? 'picker__opt picker__opt--on' : 'picker__opt'}
                  onClick={() => {
                    onChange(symbol);
                    setOpen(false);
                  }}
                >
                  <Token symbol={symbol} size={20} className="tok-select__opt" />
                  {current && <span className="picker__tick" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
