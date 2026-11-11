import {
  LIQUIDATION_BUFFER,
  MIN_COLLATERAL_RATIO,
} from './protocol-constants';

export interface PositionMetrics {
  collateralUsd: number;
  collateralRatio: number;
  collateralRatioPct: number;
  health: 'healthy' | 'warning' | 'liquidation';
  liquidationPriceUsd: number;
}

export function collateralValueUSD(collateralSPY: number, price: number): number {
  return collateralSPY * price;
}

export function maxBorrowableFUSD(collateralSPY: number, price: number): number {
  return collateralValueUSD(collateralSPY, price) / MIN_COLLATERAL_RATIO;
}

export function positionMetrics(
  collateralSPY: number,
  debtFUSD: number,
  price: number,
): PositionMetrics {
  const collateralUsd = collateralValueUSD(collateralSPY, price);
  const collateralRatio = debtFUSD <= 0 ? Number.POSITIVE_INFINITY : collateralUsd / debtFUSD;
  const liquidationPriceUsd = debtFUSD <= 0 || collateralSPY <= 0
    ? 0
    : (MIN_COLLATERAL_RATIO * debtFUSD) / collateralSPY;
  const cushion = MIN_COLLATERAL_RATIO * (1 + LIQUIDATION_BUFFER);
  const health = debtFUSD <= 0 || collateralRatio >= cushion
    ? 'healthy'
    : collateralRatio >= MIN_COLLATERAL_RATIO
      ? 'warning'
      : 'liquidation';

  return {
    collateralUsd,
    collateralRatio,
    collateralRatioPct: collateralRatio * 100,
    health,
    liquidationPriceUsd,
  };
}

export type RiskLevel = 'low' | 'medium' | 'high';

// Liquidation risk steps up with the share of the maximum LTV a position uses.
// Wider than Liquity's ETH bands, because SPY moves far less than ETH. With
// SPY's 110% minimum ratio these put Medium at a 60% LTV, where SPY has to
// fall about 34% to liquidate, and High at 75%, where a fall of about 17.5%
// is enough. On Multiply that is 2.5x and 4x.
export const LTV_RISK = { medium: 0.66, high: 0.825 } as const;

// Suggested loan sizes as a share of the most the collateral allows, one
// inside each band above.
export const DEBT_SUGGESTIONS = [0.5, 0.75, 0.88] as const;

// Redemption risk from where a rate sits against the market average: at or
// above it is low, down to 60% of it is medium, and below that is high.
export function redemptionRisk(rate: number, marketAverageRate: number | null): RiskLevel | null {
  if (marketAverageRate === null) return null;
  return rate >= marketAverageRate ? 'low' : rate >= marketAverageRate * 0.6 ? 'medium' : 'high';
}

export function liquidationRisk(ltv: number, maxLtv: number): RiskLevel {
  if (!(maxLtv > 0)) return 'high';
  const used = ltv / maxLtv;
  return used > LTV_RISK.high ? 'high' : used > LTV_RISK.medium ? 'medium' : 'low';
}
