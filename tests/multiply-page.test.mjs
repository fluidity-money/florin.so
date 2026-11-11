import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('home page links to the stablecoin multiply flow', () => {
  const home = read('app/page.tsx');

  assert.match(home, /href="\/multiply"/);
  assert.match(home, /Multiply/);
  assert.doesNotMatch(home, /Multiply[\s\S]{0,160}coming soon/);
});

test('multiply page exposes SPY looping controls and risk information', () => {
  const page = read('app/multiply/page.tsx');
  const form = read('components/multiply-form.tsx');

  assert.match(page, /MultiplyForm/);
  assert.match(form, /aria-label="SPY deposit"/);
  // The sizing slider is shared with the Manage page's leverage control.
  assert.match(form, /<LeverageField/);
  assert.match(read('components/leverage-field.tsx'), /aria-label="Multiplier"/);
  assert.match(form, /Exposure/);
  assert.match(read('components/leverage-field.tsx'), /Liquidation price/);
  assert.match(form, /redemption risk/);
  assert.match(form, /liquidation/i);
});

test('multiply submits through the leverage zapper rather than borrower operations', () => {
  const form = read('components/multiply-form.tsx');

  assert.match(form, /leverageZapperAbi/);
  assert.match(form, /functionName: 'openLeveragedTroveWithSPY'/);
  assert.match(form, /CONTRACTS\.leverageZapper/);
  assert.match(form, /CONTRACTS\.exchange/);
  assert.match(form, /quoteMultiply/);
  assert.doesNotMatch(form, /quoteExactOutput|openLeveragedTroveWithRawETH/);
  assert.match(form, /flashLoanAmount/);
  assert.match(form, /boldAmount/);
  assert.match(form, /args: \[params\]/);
  assert.doesNotMatch(form, /functionName: 'openTrove'/);
});


test('Multiply refreshes after approval, uses fee-ceiling safety, and rejects errored cached queries', () => {
  const form = read('components/multiply-form.tsx');
  const approval = form.indexOf("functionName: 'approve'");
  assert(form.indexOf('readWalletState(),') < approval);
  const refresh = form.indexOf('const [freshQuote, oracleSimulation, freshWallet]');
  assert(refresh > form.indexOf('waitForTransactionReceipt({ hash: approvalHash })'));
  assert(form.indexOf("functionName: 'predictOpenTroveUpfrontFee'", refresh) > refresh);
  assert(form.indexOf('isMultiplyCollateralSafe(amounts.totalCollateral, freshPrice, submittedBoldAmount, feeCeiling)', refresh) > refresh);
  assert(form.indexOf('const params =', refresh) > refresh);
  assert.match(form, /oraclePrice.isError \|\| swapQuote.isError \|\| chainState.isError \|\| upfrontFee.isError/);
  assert.match(form, /disabled=\{[^\n]*invalidData/);
  assert.doesNotMatch(form, /Robinhood testnet · mock exchange|Oracle-priced swaps assume FUSD/);
  assert.doesNotMatch(form, /CONTRACTS.gasCompZapper/);
});
