import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('market tables are populated from the Florin GraphQL API', () => {
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

  assert.match(markets, /fetchFlorinMarkets\(\)/);
  assert.match(home, /export const dynamic = 'force-dynamic'/);
  assert.match(markets, /borrowDetails\.map/);
  assert.match(markets, /earnRewards\.map/);
  assert.doesNotMatch(markets, /AVG_RATE|PROTOCOL_STATS|DEBT_CAP_FUSD|stabilityPoolApr|useSpyPrice/);
});
