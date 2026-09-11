// ---------------------------------------------------------------------------
// Florin — mocked protocol data.
// Everything here is FAKE CONSTANTS for the demo build. Nothing reads a chain.
// Swapping these out for real chain reads later is the seam.
// ---------------------------------------------------------------------------

export const TOKEN_SPY = 'SPY';
export const TOKEN_FUSD = 'FUSD';

// -- Market ------------------------------------------------------------------
// Fallback only. The live figure comes from /api/spy-price via useSpyPrice();
// this is what renders before that resolves, and if CoinGecko is unreachable.
// Last checked against CoinGecko on 2026-09-11.
export const SPY_PRICE_USD = 760.74;

// -- Protocol parameters ------------------------------------------------------
// These mirror MarketParams in reference/florin/core.py. Keep the two in step:
// the reference model is the spec for what the contracts should do.
export const MIN_COLLATERAL_RATIO = 1.5; // liquidation below this
export const LIQUIDATION_BUFFER = 0.05; // CR cushion before we warn
export const ORIGINATION_FEE = 0.005; // one-time, added to debt at mint
export const MIN_DEBT_FUSD = 200; // dust floor on an open position

// Borrowers choose their own rate. It is both what they pay and their place in
// the redemption queue: cheaper means redeemed against sooner.
export const MIN_RATE = 0.005;
export const MAX_RATE = 0.25;
export const DEFAULT_RATE = 0.06;

// Share of borrower interest routed to stability-pool depositors.
export const SP_INTEREST_SHARE = 0.75;

// -- Protocol level stats (mocked) -------------------------------------------
export const PROTOCOL_STATS = {
  fusdSupply: 0, // total FUSD minted & outstanding
  spyLocked: 0, // SPY shares locked as collateral protocol-wide
  stabilityPoolUsd: 0, // FUSD deposited in the stability pool
  totalDebtUsd: 0, // FUSD borrowed by all Troves
};

// -- Redemption queue (mocked book) ------------------------------------------
// Redemptions are filled from the cheapest troves first, so a borrower's rate
// decides how exposed they are. Debt in FUSD, one entry per rate bucket.
export const RATE_BOOK: { rate: number; debtFUSD: number }[] = [
  { rate: 0.01, debtFUSD: 180_000 },
  { rate: 0.025, debtFUSD: 310_000 },
  { rate: 0.04, debtFUSD: 540_000 },
  { rate: 0.06, debtFUSD: 720_000 },
  { rate: 0.09, debtFUSD: 430_000 },
  { rate: 0.14, debtFUSD: 160_000 },
];

export const RATE_BOOK_TOTAL = RATE_BOOK.reduce((t, b) => t + b.debtFUSD, 0);

// Fraction of protocol debt sitting on a cheaper rate than `rate`, and so
// ahead of this borrower in the redemption queue.
export function queueAhead(rate: number): number {
  if (RATE_BOOK_TOTAL <= 0) return 0;
  const cheaper = RATE_BOOK.filter((b) => b.rate < rate).reduce((t, b) => t + b.debtFUSD, 0);
  return cheaper / RATE_BOOK_TOTAL;
}

// -- Sample position (used on /position to demonstrate a live Trove) ---------
export const SAMPLE_POSITION = {
  collateralSPY: 120,
  debtFUSD: 40_000,
  rate: DEFAULT_RATE, // the borrower's own choice, repriceable on /position
};

// Pool yield is not a set number: it is the borrower interest routed to the
// pool, divided across whoever is in it. A high figure means the pool is small
// relative to the debt it has to absorb, so read it as a warning, not a rate.
export function stabilityPoolApr(): number {
  if (PROTOCOL_STATS.stabilityPoolUsd <= 0 || RATE_BOOK_TOTAL <= 0) return 0;
  const interest = RATE_BOOK.reduce((t, b) => t + b.debtFUSD * b.rate, 0);
  return (interest * SP_INTEREST_SHARE) / PROTOCOL_STATS.stabilityPoolUsd;
}

// -- Mock wallet holdings (drives deposit/repay limits in the demo) ----------
export const MOCK_WALLET = {
  spy: 0, // SPY shares this wallet holds
  fusd: 0, // FUSD this wallet holds
};

// -- Derived geometry ----------------------------------------------------------
export function collateralValueUSD(spy: number, price = SPY_PRICE_USD): number {
  return spy * price;
}

// Max FUSD a trove of `spy` shares can borrow at the min collateral ratio,
// assuming no existing debt on that trove. The origination fee lands on the
// debt, so the borrowable amount is the cap net of it.
export function maxBorrowableFUSD(collateralSPY: number, price = SPY_PRICE_USD): number {
  return collateralValueUSD(collateralSPY, price) / MIN_COLLATERAL_RATIO / (1 + ORIGINATION_FEE);
}

// What a borrower actually owes after drawing `borrow`. They receive `borrow`;
// the origination fee is added on top, so debt always exceeds proceeds.
export function debtAfterFee(borrow: number): number {
  return borrow * (1 + ORIGINATION_FEE);
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

export function metrics(
  collateralSPY: number,
  debtFUSD: number,
  price = SPY_PRICE_USD,
): PositionMetrics {
  const collateralUsd = collateralValueUSD(collateralSPY, price);
  const cr = debtFUSD <= 0 ? Number.POSITIVE_INFINITY : collateralUsd / debtFUSD;
  const freeUsd = maxBorrowableFUSD(collateralSPY, price) - debtFUSD;
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