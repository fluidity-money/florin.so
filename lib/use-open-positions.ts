'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { FLORIN_GRAPH_URL, OPEN_POSITIONS_QUERY } from './florin-position-query';
import { parseOpenPositions } from './florin-positions';
import { pendingPositions, emptyPositionsSnapshot } from './pending-positions';

export function useOpenPositions(owner: string | null) {
  const wallet = owner?.toLowerCase() ?? null;
  const positions = useSyncExternalStore(pendingPositions.subscribe,
    () => pendingPositions.get(wallet), emptyPositionsSnapshot);
  const [request, setRequest] = useState<{ owner: string | null; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null }>({ owner: null, status: 'idle', error: null });
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt(current => current + 1), []);

  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    setRequest({ owner: wallet, status: 'loading', error: null });
    async function load() {
      try {
        const response = await fetch(FLORIN_GRAPH_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: OPEN_POSITIONS_QUERY, variables: { owner: wallet } }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = (await response.json()) as { data?: unknown; errors?: { message: string }[]; extensions?: unknown };
        if (result.errors?.length) throw new Error(result.errors.map(({ message }) => message).join('; '));
        const indexed = parseOpenPositions(result.data);
        if (!indexed) throw new Error('Florin GraphQL returned invalid position data');
        if (controller.signal.aborted) return;
        pendingPositions.reconcile(wallet!, indexed, result.extensions);
        setRequest({ owner: wallet, status: 'ready', error: null });
      } catch (cause) {
        if (controller.signal.aborted) return;
        const detail = cause instanceof Error ? cause.message : 'unknown error';
        console.error('Unable to load Florin positions:', cause);
        setRequest({ owner: wallet, status: 'error', error: detail });
      }
    }
    void load();
    const timer = setInterval(() => { void load(); }, 15_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [wallet, attempt]);

  const current = request.owner === wallet ? request : { status: 'idle' as const, error: null };
  return { ...current, positions, refresh };
}
