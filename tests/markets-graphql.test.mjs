import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('server-rendered market data uses the Next data cache', () => {
  const graph = read('lib/florin-graph.ts');
  const markets = read('components/markets.tsx');
  const home = read('app/page.tsx');

  assert.match(graph, /https:\/\/graph\.florin\.so/);
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
    assert.match(graph, new RegExp(`\\b${field}\\b`), `query should request ${field}`);
  }

  assert.match(graph, /next:\s*\{\s*revalidate:\s*60\s*\}/);
  assert.match(markets, /await fetchFlorinMarkets\(\)/);
  assert.match(markets, /<MarketsClient initialData=\{initialData\}\s*\/>/);
  assert.doesNotMatch(home, /force-dynamic/);
});

test('browser refreshes through a same-origin route and persists the latest data', () => {
  const graph = read('lib/florin-graph.ts');
  const route = read('app/api/florin-markets/route.ts');
  const client = read('components/markets-client.tsx');

  assert.match(graph, /fetchFreshFlorinMarkets/);
  assert.match(graph, /cache:\s*'no-store'/);
  assert.match(route, /fetchFreshFlorinMarkets\(\)/);
  assert.match(route, /cache-control[^\n]*no-store/i);

  assert.match(client, /^'use client';/);
  assert.match(client, /fetch\('\/api\/florin-markets'/);
  assert.match(client, /localStorage\.getItem/);
  assert.match(client, /localStorage\.setItem/);
  assert.match(client, /useState\(initialData\)/);
});

test('market rendering no longer imports hardcoded protocol statistics', () => {
  const client = read('components/markets-client.tsx');

  assert.match(client, /borrowDetails\.map/);
  assert.match(client, /earnRewards\.map/);
  assert.doesNotMatch(client, /AVG_RATE|PROTOCOL_STATS|DEBT_CAP_FUSD|stabilityPoolApr|useSpyPrice/);
});
