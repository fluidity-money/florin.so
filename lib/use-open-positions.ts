'use client';

import { useCallback, useEffect, useState } from 'react';
import { FLORIN_GRAPH_URL, OPEN_POSITIONS_QUERY } from './florin-position-query';
import { parseOpenPositions, type FlorinPosition } from './florin-positions';

type RequestState =
  | { status: 'idle' | 'loading'; positions: FlorinPosition[]; error: null }
  | { status: 'ready'; positions: FlorinPosition[]; error: null }
  | { status: 'error'; positions: FlorinPosition[]; error: string };

export function useOpenPositions(owner: string | null) {
  const [request, setRequest] = useState<RequestState>({
    status: 'idle',
    positions: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    if (!owner) {
      setRequest({ status: 'idle', positions: [], error: null });
      return;
    }

    const controller = new AbortController();
    setRequest({ status: 'loading', positions: [], error: null });

    async function load() {
      try {
        const response = await fetch(FLORIN_GRAPH_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: OPEN_POSITIONS_QUERY, variables: { owner } }),
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = (await response.json()) as {
          data?: unknown;
          errors?: { message: string }[];
        };
        if (result.errors?.length) {
          throw new Error(result.errors.map(({ message }) => message).join('; '));
        }

        const positions = parseOpenPositions(result.data);
        if (!positions) throw new Error('Florin GraphQL returned invalid position data');
        setRequest({ status: 'ready', positions, error: null });
      } catch (cause) {
        if (controller.signal.aborted) return;
        const detail = cause instanceof Error ? cause.message : 'unknown error';
        console.error('Unable to load Florin positions:', cause);
        setRequest({ status: 'error', positions: [], error: detail });
      }
    }

    void load();
    return () => controller.abort();
  }, [owner, attempt]);

  return { ...request, refresh };
}
