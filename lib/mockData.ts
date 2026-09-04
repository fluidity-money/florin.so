// ---------------------------------------------------------------------------
// Florin — mocked protocol data.
// Everything here is FAKE CONSTANTS for the demo build. Nothing reads a chain.
// Swapping these out for real chain reads later is the seam.
// ---------------------------------------------------------------------------

export const TOKEN_SPY = 'SPY';
export const TOKEN_FUSD = 'FUSD';

// -- Market ------------------------------------------------------------------
export const SPY_PRICE_USD = 600.0; // $600.00 / share (mocked oracle)

// -- Protocol parameters ------------------------------------------------------
export const MIN_COLLATERAL_RATIO = 1.5; // 150% — liquidation below this
export const MAX_DEBT_APR = 0.059; // yearly "stability fee" charged on FUSD debt
export const STABILITY_APR = 0.039; // yearly yield paid to stability-pool depositors
export const LIQUIDATION_BUFFER = 0.05; // 5% CR cushion before warning

// -- Protocol level stats (mocked) -------------------------------------------
export const PROTOCOL_STATS = {
  fusdSupply: 124_500_000, // total FUSD minted & outstanding
  spyLocked: 221_000, // SPY shares locked as collateral protocol-wide
  stabilityPoolUsd: 4_200_000, // FUSD deposited in the stability pool
  totalDebtUsd: 118_000_000, // FUSD borrowed by all Troves
};

// -- Sample position (used on /position to demonstrate a live Trove) ---------
export const SAMPLE_POSITION = {
  collateralSPY: 120,
  debtFUSD: 40_000,
};

// -- Mock wallet holdings (drives deposit/repay limits in the demo) ----------
export const MOCK_WALLET = {
  spy: 500, // SPY shares this wallet holds
  fusd: 25_000, // FUSD this wallet holds
};

// -- Derived geometry ----------------------------------------------------------
export function collateralValueUSD(spy: number): number {
  return spy * SPY_PRICE_USD;
}

// Max FUSD a trove of `spy` shares can borrow at the min collateral ratio,
// assuming no existing debt on that trove.
export function maxBorrowableFUSD(collateralSPY: number): number {
  return collateralValueUSD(collateralSPY) / MIN_COLLATERAL_RATIO;
}

export interface PositionMetrics {
  collateralSPY: number;
  collateralUsd: number;
  debtFUSD: number;
  collateralRatio: number; // >= 1
  collateralRatioPct: number;
  freeUsd: number; // unused borrowing power
  health: 'healthy' | 'warning' | 'liquidation';
  liquidationPriceUsd: number; // SPY price at which this trove liquidates
}

export function metrics(collateralSPY: number, debtFUSD: number): PositionMetrics {
  const collateralUsd = collateralValueUSD(collateralSPY);
  const cr = debtFUSD <= 0 ? Number.POSITIVE_INFINITY : collateralUsd / debtFUSD;
  const freeUsd = maxBorrowableFUSD(collateralSPY) - debtFUSD;
  // Liquidation SPY price: where collateralUsd == minCr * debt.
  const liquidationPriceUsd = debtFUSD <= 0 ? 0 : (MIN_COLLATERAL_RATIO * debtFUSD) / collateralSPY;
  let health: PositionMetrics['health'];
  if (debtFUSD <= 0) health = 'healthy';
  else {
    const cushion = MIN_COLLATERAL_RATIO * (1 + LIQUIDATION_BUFFER);
    health = cr >= cushion ? 'healthy' : cr >= MIN_COLLATERAL_RATIO ? 'warning' : 'liquidation';
  }
  return {
    collateralSPY,
    collateralUsd,
    debtFUSD,
    collateralRatio: cr,
    collateralRatioPct: cr * 100,
    freeUsd,
    health,
    liquidationPriceUsd,
  };
}