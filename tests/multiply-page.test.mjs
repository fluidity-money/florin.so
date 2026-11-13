import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatUnits } from 'viem';

test('Multiply Max fills the exact wallet balance and guards unavailable states', () => {
	const form = read('components/multiply-form.tsx');
	const button = form.match(/<button\s+type="button"\s+className="swap__max"[\s\S]*?<\/button>/)?.[0];
	assert.ok(button);
	assert.match(button, /aria-label="Use maximum SPY deposit"/);
	assert.match(form, /<\/button>\s*<span className="swap__pill"><Token symbol="SPY"/);
	assert.match(form, /queryKey: \['multiply-state', account, zapperAddress, exchangeAddress\]/);
	const disabled = button.match(/disabled=\{([^\n]+)\}/)[1];
	const handler = button.match(/onClick=\{\(\) => \{([\s\S]*?)\}\}/)[1];
	const isDisabled = new Function('pending', 'wallet', 'account', 'chainState', `return ${disabled};`);
	const click = new Function('pending', 'wallet', 'account', 'chainState', 'setDepositStr', 'formatUnits', handler);
	const balance = 123456789012345678901n;
	const ready = { data: { balance }, isError: false };
	const cases = [
		[false, { connected: true }, 'wallet', ready, '123.456789012345678901'],
		[true, { connected: true }, 'wallet', ready, null],
		[false, { connected: false }, 'wallet', ready, null],
		[false, { connected: true }, null, ready, null],
		[false, { connected: true }, 'wallet', { data: undefined, isError: false }, null],
		[false, { connected: true }, 'wallet', { ...ready, isError: true }, null],
		[false, { connected: true }, 'wallet', { data: { balance: 0n }, isError: false }, null],
	];
	for (const [pending, wallet, account, state, expected] of cases) {
		let value = null;
		assert.equal(isDisabled(pending, wallet, account, state), expected === null);
		click(pending, wallet, account, state, (next) => { value = next; }, formatUnits);
		assert.equal(value, expected);
	}
});

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
