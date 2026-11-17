import { parseDisplayNumber, type FlorinMarkets } from './florin-markets';

export interface MarketSync {
  // Inclusive lower bound, read BEFORE graph resolvers run.
  indexedBlock?: string;
  requiredBlock?: string;
  pending?: boolean;
  receipts?: string[];
}
export type MarketSnapshot = FlorinMarkets & { marketSync?: MarketSync };
export type MarketDelta = { poolSize?: number; deposited?: number; debtIssued?: number };
export type MarketReceipt = { status: string; transactionHash: string; blockNumber: bigint };

export function withMarketCheckpoint(data: FlorinMarkets, extensions: unknown): MarketSnapshot {
  const block = (extensions as { florinIndexedBlock?: unknown } | undefined)?.florinIndexedBlock;
  return { ...data, marketSync: { indexedBlock: typeof block === 'string' && /^\d+$/.test(block) ? block : undefined } };
}

// Never add deltas to incoming graph totals: those may already include some or
// all of our transactions even when the checkpoint lower bound still lags.
export function reconcileMarkets(current: MarketSnapshot | undefined, incoming: MarketSnapshot): MarketSnapshot {
	const sync = current?.marketSync;
	const required = BigInt(sync?.requiredBlock ?? '0');
	const previous = BigInt(sync?.indexedBlock ?? '0');
  const floor = required > previous ? required : previous;
  const indexed = incoming.marketSync?.indexedBlock;
  if (floor > 0n && (!indexed || BigInt(indexed) < floor)) return current!;
  return { ...incoming, marketSync: {
    ...incoming.marketSync,
		requiredBlock: sync?.requiredBlock,
		receipts: sync?.receipts,
    pending: false,
  } };
}

function addMarketAmount(value: string, amount = 0) {
	const parsed = parseDisplayNumber(value);
	if (parsed === null || amount === 0) return value;
	return Math.max(0, parsed + amount).toLocaleString('en-US', {
		useGrouping: false, maximumFractionDigits: 6,
	});
}

function marketIncludesReceipt(sync: MarketSync | undefined, receipt: MarketReceipt) {
	if (sync?.receipts?.includes(receipt.transactionHash)) return true;
	const indexed = sync?.indexedBlock;
	return Boolean(indexed && BigInt(indexed) >= receipt.blockNumber);
}

export function applyMarketReceipt(
  current: MarketSnapshot | undefined,
  before: MarketSnapshot | undefined,
  receipt: MarketReceipt,
  delta: MarketDelta,
): MarketSnapshot | undefined {
	const sync = current?.marketSync;
	if (receipt.status !== 'success' || marketIncludesReceipt(sync, receipt)) return current;
  // Capture before submission, not after a potentially already-indexed response.
  // Multiple confirmations accumulate on the existing optimistic snapshot.
  const base = sync?.pending ? current : before;
  if (!base) return current;
	const required = BigInt(sync?.requiredBlock ?? '0');
  return {
    ...base,
    borrowDetails: base.borrowDetails.map(row => row.collateral.name !== 'SPY' ? row : {
      ...row, deposited: addMarketAmount(row.deposited, delta.deposited), debtIssued: addMarketAmount(row.debtIssued, delta.debtIssued),
    }),
    earnRewards: base.earnRewards.map(row => row.collateral.name !== 'SPY' ? row : {
      ...row, poolSize: addMarketAmount(row.poolSize, delta.poolSize),
    }),
    marketSync: {
      indexedBlock: base.marketSync?.indexedBlock,
      requiredBlock: String(required > receipt.blockNumber ? required : receipt.blockNumber),
      pending: true,
      receipts: [...(sync?.receipts ?? []), receipt.transactionHash],
    },
  };
}
