import { formatUnits } from 'viem';

export interface FlorinPositionWire {
  troveId: string;
  troveManager: string;
  owner: string;
  debt: string;
  collateral: string;
  stake: string;
  annualInterestRate: string;
  interestBatchManager: string | null;
}

export interface FlorinPosition extends FlorinPositionWire {
  debtFUSD: number;
  collateralSPY: number;
  rate: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPosition(value: unknown): value is FlorinPositionWire {
  if (!isRecord(value)) return false;

  return (
    typeof value.troveId === 'string' &&
    typeof value.troveManager === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.debt === 'string' &&
    typeof value.collateral === 'string' &&
    typeof value.stake === 'string' &&
    typeof value.annualInterestRate === 'string' &&
    (value.interestBatchManager === null || typeof value.interestBatchManager === 'string')
  );
}

export function parseOpenPositions(value: unknown): FlorinPosition[] | null {
  if (!isRecord(value) || !Array.isArray(value.openPositions)) return null;
  if (!value.openPositions.every(isPosition)) return null;

  try {
    return value.openPositions.map((position) => {
      const collateralSPY = Number(formatUnits(BigInt(position.collateral), 18));
      const debtFUSD = Number(formatUnits(BigInt(position.debt), 18));
      const rate = parseFloat(position.annualInterestRate) / 100;
      if (![collateralSPY, debtFUSD, rate].every(Number.isFinite)) {
        throw new Error('position contains a non-finite number');
      }
      return { ...position, collateralSPY, debtFUSD, rate };
    });
  } catch {
    return null;
  }
}
