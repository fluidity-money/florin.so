import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('server-rendered market data uses the Next data cache', () => {
  const graph = read('lib/florin-graph.ts');
  const query = read('lib/florin-market-query.ts');
  const markets = read('components/markets.tsx');
  const home = read('app/page.tsx');

  assert.match(query, /https:\/\/graph\.florin\.so/);
  for (const field of [
    'borrowDetails',
    'avgRatePa',
    'deposited',
    'debtIssued',
    'earnRewards',
    'apr',
    'poolSize',
    'coverage',
  ]) {
    assert.match(query, new RegExp(`\\b${field}\\b`), `query should request ${field}`);
  }

  assert.match(graph, /next:\s*\{\s*revalidate:\s*60\s*\}/);
  assert.match(markets, /await fetchFlorinMarkets\(\)/);
  assert.match(markets, /<MarketsClient initialData=\{initialData\}\s*\/>/);
  assert.doesNotMatch(home, /force-dynamic/);
});

test('browser refreshes directly from Florin GraphQL and persists the latest data', () => {
  const query = read('lib/florin-market-query.ts');
  const client = read('components/markets-client.tsx');
  const hook = read('lib/use-florin-markets.ts');

  assert.match(client, /^'use client';/);
  assert.match(client, /useFlorinMarkets\(initialData\)/);
  assert.match(hook, /fetch\(FLORIN_GRAPH_URL/);
  assert.match(hook, /method:\s*'POST'/);
  assert.match(hook, /body:\s*JSON\.stringify\(\{\s*query:\s*MARKET_QUERY\s*\}\)/);
  assert.match(hook, /cache:\s*'no-store'/);
  assert.match(query, /https:\/\/graph\.florin\.so/);
  assert.doesNotMatch(hook, /\/api\/florin-markets/);
  assert.equal(
    existsSync(new URL('../app/api/florin-markets/route.ts', import.meta.url)),
    false,
    'the Next.js market API route should not exist',
  );
  assert.match(hook, /localStorage\.getItem/);
  assert.match(hook, /localStorage\.setItem/);
  assert.match(hook, /queryKey:\s*QUERY_KEY/);
  assert.match(hook, /initialData/);
  assert.match(hook, /refetchInterval:\s*60_000/);
});

test('market rendering no longer imports hardcoded protocol statistics', () => {
  const client = read('components/markets-client.tsx');

  assert.match(client, /borrowDetails\.map/);
  assert.match(client, /earnRewards\.map/);
  assert.doesNotMatch(client, /AVG_RATE|PROTOCOL_STATS|DEBT_CAP_FUSD|stabilityPoolApr|useSpyPrice/);
});
