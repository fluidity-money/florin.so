// Formatting helpers for the numeric-heavy UI. Tabular numerals in HTML.

export function money(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function int(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function pct(n: number, decimals = 1): string {
  return `${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

export function shortAddr(a: string): string {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// Parse a user-typed number, tolerating commas / spaces.
export function xnum(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
