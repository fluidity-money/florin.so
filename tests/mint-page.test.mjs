import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('borrow page labels the selected output token while keeping USDG debt in FUSD', () => {
	const open = read('components/open-position-form.tsx');

	assert.doesNotMatch(open, /BOLD/);
	assert.match(open, /useState<LoanToken>\('FUSD'\)/);
	assert.match(open, /aria-label=\{`\$\{loanToken\} to borrow`\}/);
	assert.match(open, /usdgSelected \? 'USDG borrowed' : 'FUSD minted'/);
	assert.match(open, /usdgSelected \? 'Borrow USDG →' : 'Mint FUSD →'/);
	assert.match(open, /Your debt and repayments are in FUSD/);
});

test('mint page shows liquidation price for the proposed position', () => {
  const open = read('components/open-position-form.tsx');

  assert.match(open, /const liquidationPrice =/);
  assert.match(open, /Liquidation price/);
});

test('borrow Max uses the selected token capacity and requires fresh state and quote', () => {
	const open = read('components/open-position-form.tsx');
	const body = open.match(/captureEvent\('max_amount_selected', \{ context: 'open_position', asset: loanToken \}\);([\s\S]*?)\n\s*\}\}/)[1];
	const run = new Function('usdgSelected', 'pending', 'quoteReady', 'openingState', 'openingQuote', 'requireOpeningQuote', 'formatLoanMax', 'setDebtStr', 'reportError', body);
	for (const usdg of [false, true]) {
		for (const scenario of ['ready', 'pending', 'unready', 'state-error', 'quote-error']) {
			const state = { invalid: scenario === 'state-error' };
			const quote = { invalid: scenario === 'quote-error', maxPrincipal: 123n, maxUsdg: 456n };
			const reads = [], values = [], errors = [];
			run(usdg, scenario === 'pending', scenario !== 'unready', state, quote, value => {
				reads.push(value);
				if (value.invalid) throw new Error('stale quote');
				return value;
			}, value => value.toString(), value => values.push(value), error => errors.push(error));
			assert.deepEqual(values, scenario === 'ready' ? [usdg ? '456' : '123'] : []);
			assert.deepEqual(reads, scenario === 'state-error' ? [state] : [state, quote]);
			assert.equal(errors.length, scenario.endsWith('-error') ? 1 : 0);
		}
	}
	assert.match(open, /disabled=\{pending \|\| !quoteReady \|\| maxBorrowWei <= 0n\}/);
	assert.match(open, /usdgSelected && swap \? formatUnits\(amount, swap.decimals\) : formatOpeningMax\(amount\)/);
	assert.match(open, />\s*Max\s*</);
});

test('mint page uses the live market average without inventing queue depth', () => {
  const open = read('components/open-position-form.tsx');

  assert.match(open, /redemptionRisk/);
  assert.match(open, /redemption risk/);
  assert.match(open, /marketAverageRate/);
  assert.doesNotMatch(open, /Redeemable before you|queueAhead|RATE_BOOK_TOTAL/);
});

test('mint flow signs SPY permit and sends native compensation in one zapper transaction', () => {
  const open = read('components/open-position-form.tsx');

  assert.match(open, /functionName: 'openTroveWithRawETHPermit'/);
  assert.match(open, /value: LIQUIDATOR_COMPENSATION_WETH/);
  assert.match(open, /CONTRACTS\.gasCompZapper/);
  assert.match(open, /walletClient.signTypedData\(typedPermit\)/);
  assert.doesNotMatch(open, /functionName: '(approve|deposit|openTrove)'/);
  assert.match(open, /one transaction with 0\.001 ETH/);
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