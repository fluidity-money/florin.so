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
