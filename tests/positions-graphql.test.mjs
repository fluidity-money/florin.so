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
	assert.match(hook, /const wallet = owner\?\.toLowerCase\(\) \?\? null/);
	assert.match(hook, /method:\s*'POST'/);
	assert.match(hook, /variables:\s*\{\s*owner:\s*wallet\s*\}/);
	assert.match(hook, /pendingPositions\.get\(wallet\)/);
	assert.match(hook, /if \(controller.signal.aborted\) return;\s*pendingPositions.reconcile\(wallet!, indexed, result.extensions\)/);
	assert.match(hook, /request.owner === wallet \? request : \{ status: 'idle' as const, error: null \}/);
	assert.match(hook, /setInterval\([\s\S]*?15_000\)/);
	assert.match(hook, /controller.abort\(\); clearInterval\(timer\)/);
  assert.match(manage, /useOpenPositions\(w\.address\)/);
  assert.match(manage, /Loading position/);
  assert.match(manage, /Unable to load position/);
  assert.match(manage, /No position found/);
  assert.doesNotMatch(manage, /SAMPLE_POSITION|canViewSamplePosition/);
});

test('manage position supports owners with more than one open trove', () => {
  const manage = read('components/manage-position.tsx');

  assert.match(manage, /positions\.length\s*>\s*1/);
	assert.match(manage, /const selectionScope = `\$\{w.address\?\.toLowerCase\(\)\}:\$\{requestedPosition\}`/);
	assert.match(manage, /selectPosition\(positions, selection\?\.scope === selectionScope \? selection.key : requestedPosition\)/);
	assert.match(manage, /onSelect=\{key => setSelection\(\{ scope: selectionScope, key \}\)\}/);
	assert.match(manage, /key=\{`\$\{w.address\}:\$\{positionKey\(position\)\}`\}/);
	assert.match(manage, /key=\{positionKey\(candidate\)\}/);
	assert.match(manage, /onSelect\(positionKey\(candidate\)\)/);
	assert.match(manage, /shortTroveId\(position.troveId\)/);
	assert.match(manage, /Position not available/);
});
