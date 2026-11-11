import { decodeEventLog, formatUnits, parseAbi, type TransactionReceipt } from 'viem';
import { parseOpenPositions, type FlorinPosition } from './florin-positions';

// Handwritten subset of ITroveEvents. Only creation operations seed this cache;
// approvals and unrelated successful transactions cannot invent a position.
export const creationEventsAbi = parseAbi([
  'event TroveOperation(uint256 indexed _troveId, uint8 _operation, uint256 _annualInterestRate, uint256 _debtIncreaseFromRedist, uint256 _debtIncreaseFromUpfrontFee, int256 _debtChangeFromOperation, uint256 _collIncreaseFromRedist, int256 _collChangeFromOperation)',
  'event TroveUpdated(uint256 indexed _troveId, uint256 _debt, uint256 _coll, uint256 _stake, uint256 _annualInterestRate, uint256 _snapshotOfTotalCollRedist, uint256 _snapshotOfTotalDebtRedist)',
]);

export function positionsFromReceipt(owner: string, manager: string, receipt: Pick<TransactionReceipt, 'status' | 'logs'>): FlorinPosition[] {
  if (receipt.status !== 'success') return [];
  const created = new Set<string>();
  const snapshots = new Map<string, FlorinPosition>();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== manager.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi: creationEventsAbi, data: log.data, topics: log.topics });
      const id = event.args._troveId.toString();
      if (event.eventName === 'TroveOperation') {
        if (event.args._operation === 0) created.add(id);
      } else {
        const args = event.args;
        const position = parseOpenPositions({ openPositions: [{
          troveId: id, troveManager: manager, owner,
          debt: args._debt.toString(), collateral: args._coll.toString(),
          stake: args._stake.toString(), annualInterestRate: formatUnits(args._annualInterestRate, 16),
          interestBatchManager: null,
        }] })?.[0];
        if (position) snapshots.set(id, position);
      }
    } catch { /* Other events from the same manager are not creation evidence. */ }
  }
  return [...created].flatMap(id => {
    const position = snapshots.get(id);
    return position && BigInt(position.debt) > 0n ? [position] : [];
  });
}

const key = (position: FlorinPosition) => `${position.troveManager.toLowerCase()}:${BigInt(position.troveId)}`;
const empty: FlorinPosition[] = [];
type WalletState = {
  positions: FlorinPosition[];
  pending: Map<string, { position: FlorinPosition; block: bigint }>;
  watermark: bigint | null;
};

// Module-scoped, wallet-scoped session cache survives client route navigation.
// No TTL: elapsed time is not evidence that the indexer has caught up.
export function createPositionCache() {
  const wallets = new Map<string, WalletState>();
  const listeners = new Set<() => void>();
  const state = (owner: string) => {
    const wallet = owner.toLowerCase();
    if (!wallets.has(wallet)) wallets.set(wallet, { positions: [], pending: new Map(), watermark: null });
    return wallets.get(wallet)!;
  };
  const notify = () => listeners.forEach(listener => listener());
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    get(owner: string | null) { return owner ? wallets.get(owner.toLowerCase())?.positions ?? empty : empty; },
    confirm(owner: string, manager: string, receipt: Pick<TransactionReceipt, 'status' | 'logs' | 'blockNumber'>) {
      const positions = positionsFromReceipt(owner, manager, receipt);
      if (!positions.length) return;
      const current = state(owner);
      if (current.watermark !== null && current.watermark >= receipt.blockNumber) return;
      const merged = new Map(current.positions.map(position => [key(position), position]));
      for (const position of positions) {
        const id = key(position);
        if (merged.has(id)) continue;
        current.pending.set(id, { position, block: receipt.blockNumber });
        merged.set(id, position);
      }
      current.positions = [...merged.values()];
      notify();
    },
    reconcile(owner: string, positions: FlorinPosition[], extensions?: unknown) {
      const current = state(owner);
      const raw = (extensions as { florinIndexedBlock?: unknown } | undefined)?.florinIndexedBlock;
      const block = typeof raw === 'string' && /^\d+$/.test(raw) ? BigInt(raw) : null;
      if (current.watermark !== null && block !== null && block < current.watermark) return;
      // Without a checkpoint, absence cannot remove a previously observed row.
      const merged = new Map((block === null ? current.positions : []).map(position => [key(position), position]));
      for (const position of positions) merged.set(key(position), position);
      const indexed = new Set(positions.map(key));
      for (const [id, pending] of current.pending) {
        if (indexed.has(id) || (block !== null && block >= pending.block)) {
          current.pending.delete(id);
          if (current.watermark === null || current.watermark < pending.block) current.watermark = pending.block;
        } else merged.set(id, pending.position);
      }
      if (block !== null && (current.watermark === null || block > current.watermark)) current.watermark = block;
      current.positions = [...merged.values()];
      notify();
    },
  };
}

export const pendingPositions = createPositionCache();
export const emptyPositionsSnapshot = () => empty;
