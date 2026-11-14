import { MARKET_CLOSED_TITLE } from '../lib/transaction-error';

// Shown while the NYSE is closed, before anyone signs something that would
// only revert. `paused` names what is unavailable on this page.
export function MarketClosedNotice({ paused }: { paused: string }) {
  return (
    <p className="swap__over" role="status">
      <b>{MARKET_CLOSED_TITLE}</b> {paused} paused until the NYSE opens, 9:30 ET on trading days.
    </p>
  );
}
