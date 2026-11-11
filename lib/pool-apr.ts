// Realised Stability Pool APR over a window, from the pool's own accounting.
//
// The pool keeps a running total, B, of FUSD yield paid per unit deposited,
// and emits it (B_Updated) every time yield is paid in. A depositor who was in
// the pool at one B and is still in at a later B has earned
//
//   deposit * (B_end - B_start) / P_start
//
// which is exactly how the contract computes a depositor's yield. So the
// difference between two B values, divided by P at the first, is the return
// on one FUSD over that stretch, with no estimating. It covers borrower
// interest and upfront fees. Liquidation gains are paid in SPY and are not
// part of it.
//
// No imports here on purpose, so the maths can be tested on its own.

export const YEAR_SECONDS = 365 * 86_400;

export interface YieldPoint {
  block: bigint;
  b: bigint;
  scale: bigint;
}

export interface PUpdate {
  block: bigint;
  p: bigint;
}

// B as it would read if the yield accrued since the last payout were paid in
// now. This is what lets a window end at the present instead of at the last
// time anyone happened to touch the pool.
export function effectiveB(b: bigint, p: bigint, pendingYield: bigint, totalDeposits: bigint): bigint {
  if (totalDeposits <= 0n || pendingYield <= 0n) return b;
  return b + (p * pendingYield) / totalDeposits;
}

// Where a window starts: the last payout at or before the window's first
// block. `full` is false when the pool has no payout that old, in which case
// the earliest payout on record stands in and the caller decides whether that
// is enough history to show a figure.
export function pickBaseline<T extends { block: bigint }>(
  points: T[],
  startBlock: bigint,
): { point: T; full: boolean } | null {
  if (points.length === 0) return null;
  let found: T | null = null;
  for (const point of points) {
    if (point.block <= startBlock) found = point;
    else break;
  }
  return found ? { point: found, full: true } : { point: points[0], full: false };
}

// P at a given block. P only moves on a liquidation, and each move is logged
// with the new value, so: no moves on record means it has been `pNow`
// throughout, a move at or before the block gives the value directly, and
// moves only after the block leave the earlier value unknown.
export function pAt(updates: PUpdate[], block: bigint, pNow: bigint): bigint | null {
  if (updates.length === 0) return pNow;
  let found: bigint | null = null;
  for (const update of updates) {
    if (update.block <= block) found = update.p;
    else break;
  }
  return found;
}

// Annualised return on one FUSD between two B readings. Null when there is
// nothing sensible to say.
export function realisedApr(bStart: bigint, bEnd: bigint, pStart: bigint, elapsedSeconds: number): number | null {
  if (pStart <= 0n || elapsedSeconds <= 0 || bEnd < bStart) return null;
  // Scale to 1e12 before leaving bigint, so the ratio keeps its precision.
  const gain = Number(((bEnd - bStart) * 10n ** 12n) / pStart) / 1e12;
  return (gain * YEAR_SECONDS) / elapsedSeconds;
}
