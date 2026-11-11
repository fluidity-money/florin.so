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
// These are the same bands Liquity's own interface draws.
export const LTV_RISK = { medium: 0.54, high: 0.73 } as const;

// Suggested loan sizes as a share of the most the collateral allows, one for
// each band above.
export const DEBT_SUGGESTIONS = [0.3, 0.6, 0.8] as const;

export function liquidationRisk(ltv: number, maxLtv: number): RiskLevel {
  if (!(maxLtv > 0)) return 'high';
  const used = ltv / maxLtv;
  return used > LTV_RISK.high ? 'high' : used > LTV_RISK.medium ? 'medium' : 'low';
}
