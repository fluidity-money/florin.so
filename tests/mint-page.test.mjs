import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('mint page presents the borrowed token only as FUSD', () => {
  const open = read('components/open-position-form.tsx');

  assert.doesNotMatch(open, /BOLD/);
  assert.match(open, /FUSD minted/);
  assert.match(open, /aria-label="FUSD to borrow"/);
  assert.match(open, /Mint FUSD/);
});

test('mint page shows liquidation price for the proposed position', () => {
  const open = read('components/open-position-form.tsx');

  assert.match(open, /const liquidationPrice =/);
  assert.match(open, /Liquidation price/);
});

test('mint page offers a maximum FUSD amount', () => {
  const open = read('components/open-position-form.tsx');

  assert.match(open, /className="swap__max"/);
  assert.match(open, /setDebtStr\(maxBorrow/);
  assert.match(open, />\s*Max\s*</);
});

test('mint page shows redemption risk and debt ahead in the queue', () => {
  const open = read('components/open-position-form.tsx');

  assert.match(open, /redemptionRisk/);
  assert.match(open, /redemption risk/);
  assert.match(open, /Redeemable before you/);
});