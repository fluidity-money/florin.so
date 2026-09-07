import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('all public protocol stats and mock wallet balances start at zero', () => {
  const source = read('lib/mockData.ts');

  for (const field of ['fusdSupply', 'spyLocked', 'stabilityPoolUsd', 'totalDebtUsd', 'spy', 'fusd']) {
    assert.match(source, new RegExp(`${field}:\\s*0(?:[,;]|\\s*\\})`), `${field} should be zero`);
  }

  assert.match(source, /STABILITY_APR\s*=\s*0(?:[,;]|\s)/);
});

test('interactive forms do not start with fake amounts', () => {
  const open = read('components/open-position-form.tsx');
  const manage = read('components/manage-position.tsx');
  const stability = read('components/stability-pool.tsx');

  assert.match(open, /useState\('0'\)/);
  assert.doesNotMatch(open, /useState\('(100|36000)'\)/);
  assert.doesNotMatch(manage, /useState\('(20|10|5000)'\)/);
  assert.match(stability, /useState\(0\)/);
  assert.match(stability, /useState\('0'\)/);
});

test('leverage card is non-navigable and marked disabled', () => {
  const home = read('app/page.tsx');
  assert.match(home, /aria-disabled="true"/);
  assert.match(home, /home-action--disabled/);
  assert.doesNotMatch(home, /<Link href="\/open" className="card home-action home-action--blue">/);
});

test('sample trove is gated to the designated address', () => {
  const access = read('lib/position-access.ts');
  const manage = read('components/manage-position.tsx');
  const positionPage = read('app/position/page.tsx');

  assert.match(access, /0x6221a9c005f6e47eb398fd867784cacfdcfff4e7/i);
  assert.match(access, /toLowerCase\(\)/);
  assert.match(manage, /canViewSamplePosition\(w\.address\)/);
  assert.match(manage, /No position found/);
  assert.doesNotMatch(positionPage, /A live \(mocked\) Trove/);
});
