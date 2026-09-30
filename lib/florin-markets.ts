export interface BorrowDetails {
  collateral: { name: string };
  avgRatePa: string;
  deposited: string;
  debtIssued: string;
}

export interface EarnRewards {
  collateral: { name: string };
  apr: string;
  poolSize: string;
  coverage: string;
}

export interface FlorinMarkets {
  borrowDetails: BorrowDetails[];
  earnRewards: EarnRewards[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasCollateral(
  value: unknown,
): value is Record<string, unknown> & { collateral: { name: string } } {
  return (
    isRecord(value) &&
    isRecord(value.collateral) &&
    typeof value.collateral.name === 'string'
  );
}

export function isFlorinMarkets(value: unknown): value is FlorinMarkets {
  if (
    !isRecord(value) ||
    !Array.isArray(value.borrowDetails) ||
    !Array.isArray(value.earnRewards)
  ) {
    return false;
  }

  return (
    value.borrowDetails.every(
      (details) =>
        hasCollateral(details) &&
        typeof details.avgRatePa === 'string' &&
        typeof details.deposited === 'string' &&
        typeof details.debtIssued === 'string',
    ) &&
    value.earnRewards.every(
      (rewards) =>
        hasCollateral(rewards) &&
        typeof rewards.apr === 'string' &&
        typeof rewards.poolSize === 'string' &&
        typeof rewards.coverage === 'string',
    )
  );
}

export function hasMarketData(markets: FlorinMarkets): boolean {
  return markets.borrowDetails.length > 0 || markets.earnRewards.length > 0;
}

export function spyMarket(markets: FlorinMarkets): {
  borrow: BorrowDetails | null;
  earn: EarnRewards | null;
} {
  return {
    borrow: markets.borrowDetails.find(({ collateral }) => collateral.name === 'SPY') ?? null,
    earn: markets.earnRewards.find(({ collateral }) => collateral.name === 'SPY') ?? null,
  };
}

// The graph hands back display strings rather than raw amounts ("15",
// "2.01K", "1.5M"), so anything that needs arithmetic on them has to read the
// suffix back off. Returns null rather than 0 on junk, so a caller can tell
// "no data" from "genuinely zero".
const MAGNITUDES: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

export function parseDisplayNumber(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().replace(/,/g, '').match(/^(-?\d*\.?\d+)\s*([KMBT])?$/i);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = match[2]?.toUpperCase();
  return suffix ? amount * MAGNITUDES[suffix] : amount;
}

export function parseDisplayPercent(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace('%', ''));
  return Number.isFinite(parsed) ? parsed / 100 : null;
}
