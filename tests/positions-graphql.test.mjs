import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('position query requests every open-position field for the connected owner', () => {
  const query = read('lib/florin-position-query.ts');

  assert.match(query, /query OpenPositions\(\$owner:\s*Address!\)/);
  assert.match(query, /openPositions\(owner:\s*\$owner\)/);
  for (const field of [
    'troveId',
    'troveManager',
    'owner',
    'debt',
    'collateral',
    'stake',
    'annualInterestRate',
    'interestBatchManager',
  ]) {
    assert.match(query, new RegExp(`\\b${field}\\b`), `query should request ${field}`);
  }
});

test('position data is validated and converted from GraphQL wire units', () => {
  const positions = read('lib/florin-positions.ts');

  assert.match(positions, /formatUnits\(BigInt\(position\.collateral\),\s*18\)/);
  assert.match(positions, /formatUnits\(BigInt\(position\.debt\),\s*18\)/);
  assert.match(positions, /parseFloat\(position\.annualInterestRate\)\s*\/\s*100/);
  assert.match(positions, /Array\.isArray\(value\.openPositions\)/);
});

test('manage position loads live positions for the wallet and handles request states', () => {
  const manage = read('components/manage-position.tsx');
  const hook = read('lib/use-open-positions.ts');

  assert.match(hook, /fetch\(FLORIN_GRAPH_URL/);
  assert.match(hook, /variables:\s*\{\s*owner\s*\}/);
  assert.match(hook, /cache:\s*'no-store'/);
  assert.match(manage, /useOpenPositions\(w\.address\)/);
  assert.match(manage, /Loading position/);
  assert.match(manage, /Unable to load position/);
  assert.match(manage, /No position found/);
  assert.doesNotMatch(manage, /SAMPLE_POSITION|canViewSamplePosition/);
});

test('manage position supports owners with more than one open trove', () => {
  const manage = read('components/manage-position.tsx');

  assert.match(manage, /positions\.length\s*>\s*1/);
  assert.match(manage, /setSelectedTroveId/);
  assert.match(manage, /Trove #/);
});
