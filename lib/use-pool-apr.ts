'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAbi, parseAbiItem } from 'viem';
import { CONTRACTS } from './borrow-contract';
import { robinhoodPublicClient } from './robinhood-client';
import { effectiveB, pAt, pickBaseline, realisedApr, type PUpdate, type YieldPoint } from './pool-apr';

const DAY = 86_400;
// Far enough back to find a payout older than the longest window.
const LOOKBACK_SECONDS = 8 * DAY;
// Blocks sampled to measure how fast the chain is producing them.
const PACE_SAMPLE = 100_000n;

const B_UPDATED = parseAbiItem('event B_Updated(uint256 _B, uint256 _scale)');
const P_UPDATED = parseAbiItem('event P_Updated(uint256 _P)');

const poolAccountingAbi = parseAbi([
  'function P() view returns (uint256)',
  'function currentScale() view returns (uint256)',
  'function scaleToB(uint256 scale) view returns (uint256)',
  'function getTotalBoldDeposits() view returns (uint256)',
]);

const activePoolYieldAbi = parseAbi([
  'function calcPendingSPYield() view returns (uint256)',
]);

export interface PoolApr {
  apr24h: number | null;
  apr7d: number | null;
}

const NONE: PoolApr = { apr24h: null, apr7d: null };

async function readPoolApr(): Promise<PoolApr> {
  const client = robinhoodPublicClient;
  const latest = await client.getBlock();
  if (latest.number === null || latest.number <= PACE_SAMPLE) return NONE;

  const sample = await client.getBlock({ blockNumber: latest.number - PACE_SAMPLE });
  const now = Number(latest.timestamp);
  const secondsPerBlock = (now - Number(sample.timestamp)) / Number(PACE_SAMPLE);
  if (!(secondsPerBlock > 0)) return NONE;

  const blocksBack = (seconds: number) => {
    const blocks = BigInt(Math.ceil(seconds / secondsPerBlock));
    return latest.number! > blocks ? latest.number! - blocks : 0n;
  };

  // One event per query. The RPC caps a query that asks for several events at
  // once to 100,000 blocks, and a week is far more than that.
  const range = { address: CONTRACTS.stabilityPool, fromBlock: blocksBack(LOOKBACK_SECONDS), toBlock: latest.number };
  const [bLogs, pLogs, p, scale, totalDeposits, pendingYield] = await Promise.all([
    client.getLogs({ ...range, event: B_UPDATED }),
    client.getLogs({ ...range, event: P_UPDATED }),
    client.readContract({ address: CONTRACTS.stabilityPool, abi: poolAccountingAbi, functionName: 'P', blockNumber: latest.number }),
    client.readContract({ address: CONTRACTS.stabilityPool, abi: poolAccountingAbi, functionName: 'currentScale', blockNumber: latest.number }),
    client.readContract({ address: CONTRACTS.stabilityPool, abi: poolAccountingAbi, functionName: 'getTotalBoldDeposits', blockNumber: latest.number }),
    client.readContract({ address: CONTRACTS.activePool, abi: activePoolYieldAbi, functionName: 'calcPendingSPYield', blockNumber: latest.number }),
  ]);
  const b = await client.readContract({
    address: CONTRACTS.stabilityPool,
    abi: poolAccountingAbi,
    functionName: 'scaleToB',
    args: [scale],
    blockNumber: latest.number,
  });

  const points: YieldPoint[] = [];
  const pUpdates: PUpdate[] = [];
  for (const log of bLogs) {
    if (log.blockNumber !== null && log.args._B !== undefined && log.args._scale !== undefined) {
      points.push({ block: log.blockNumber, b: log.args._B, scale: log.args._scale });
    }
  }
  for (const log of pLogs) {
    if (log.blockNumber !== null && log.args._P !== undefined) {
      pUpdates.push({ block: log.blockNumber, p: log.args._P });
    }
  }

  const bNow = effectiveB(b, p, pendingYield, totalDeposits);

  async function over(windowSeconds: number): Promise<number | null> {
    const baseline = pickBaseline(points, blocksBack(windowSeconds));
    // A scale change in the window means a near-total wipe of the pool, and
    // the simple difference no longer describes a depositor's return.
    if (!baseline || baseline.point.scale !== scale) return null;
    const pStart = pAt(pUpdates, baseline.point.block, p);
    if (pStart === null) return null;
    const start = await client.getBlock({ blockNumber: baseline.point.block });
    const elapsed = now - Number(start.timestamp);
    // A pool younger than the window still gets a figure once it has run for
    // half of it. Less than that and one early payout would be the whole story.
    if (!baseline.full && elapsed < windowSeconds / 2) return null;
    return realisedApr(baseline.point.b, bNow, pStart, elapsed);
  }

  const [apr24h, apr7d] = await Promise.all([over(DAY), over(7 * DAY)]);
  return { apr24h, apr7d };
}

// Realised APR over the last day and the last week, read from the chain.
// Either figure is null while it cannot be worked out, and the page shows a
// dash rather than a guess.
export function usePoolApr(): PoolApr {
  const query = useQuery({
    queryKey: ['stability-pool-realised-apr'],
    queryFn: readPoolApr,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  return query.data ?? NONE;
}
