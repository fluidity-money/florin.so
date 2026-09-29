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

export function parseDisplayPercent(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace('%', ''));
  return Number.isFinite(parsed) ? parsed / 100 : null;
}
