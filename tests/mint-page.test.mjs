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

test('mint page uses the live market average without inventing queue depth', () => {
  const open = read('components/open-position-form.tsx');

  assert.match(open, /redemptionRisk/);
  assert.match(open, /redemption risk/);
  assert.match(open, /marketAverageRate/);
  assert.doesNotMatch(open, /Redeemable before you|queueAhead|RATE_BOOK_TOTAL/);
});

test('mint flow wraps ETH and approves WETH for liquidator compensation', () => {
  const open = read('components/open-position-form.tsx');

  assert.match(open, /functionName: 'deposit'/);
  assert.match(open, /LIQUIDATOR_COMPENSATION_WETH/);
  assert.match(open, /CONTRACTS\.weth/);
  assert.doesNotMatch(open, /value: LIQUIDATOR_COMPENSATION_ETH/);
  assert.match(open, /wraps up to 0\.001 ETH into WETH/);
  assert.doesNotMatch(open, /0\.001 SPY gas-compensation deposit/);
});

test('mint failures show an explanation and report the error to PostHog', () => {
  const open = read('components/open-position-form.tsx');

  assert.match(open, /captureEvent\('position_open_failed'/);
  assert.match(open, /error\.explanation/);
  assert.match(open, /Technical details/);
  assert.match(open, /<code>\{error\.technicalDetails\}<\/code>/);
  assert.match(open, /txHash && \(pending \|\| error\)/);
  assert.match(open, /failure_stage: description\.stage/);
});