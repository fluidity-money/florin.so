import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatUnits } from 'viem';

const source = readFileSync(new URL('../components/open-position-form.tsx', import.meta.url), 'utf8');
const capacity = readFileSync(new URL('../lib/opening-capacity.ts', import.meta.url), 'utf8');
const formatBody = capacity.match(/export function formatOpeningMax\(amount: bigint\) \{([\s\S]*?)\n\}/)[1];
const formatOpeningMax = new Function('amount', 'OPENING_STEP', formatBody);
const clickBody = source.match(/aria-label="Use maximum SPY collateral"[\s\S]*?onClick=\{\(\) => \{([\s\S]*?)\n\s*\}\}/)[1];
const effectBody = source.match(/useEffect\(\(\) => \{([\s\S]*?)\n\s*\}, \[autoMaxLoan/)[1];

// Execute the actual component handlers with controlled state, not a duplicate implementation.
function harness(overrides = {}) {
	const state = {
		autoMaxLoan: null, pending: false, wallet: { connected: true }, account: 'wallet-a',
		collateralWei: 0n, debtStr: '', openingQuote: { isError: false },
		quoteReady: false, maxBorrowWei: 123450000000000000000n,
		chainState: { data: { balance: 1234567890123456789n }, isError: false },
		...overrides,
	};
	const bindings = {
		setAutoMaxLoan: (value) => { state.autoMaxLoan = value; },
		setDebtStr: (value) => { state.debtStr = value; },
		setSpyStr: (value) => { state.spyStr = value; },
		markFormStarted: () => {}, captureEvent: () => {}, formatUnits,
		formatOpeningMax: (value) => formatOpeningMax(value, 10n ** 16n),
	};
	const run = (body) => {
		const values = { ...state, ...bindings };
		new Function(...Object.keys(values), body)(...Object.values(values));
	};
	return { state, click: () => run(clickBody), effect: () => run(effectBody) };
}

test('collateral Max waits for the new quote then fills the loan exactly once', () => {
	const { state, click, effect } = harness();
	click();
	assert.equal(state.spyStr, '1.234567890123456789');
	assert.deepEqual(state.autoMaxLoan, { account: 'wallet-a', collateral: state.chainState.data.balance });
	state.collateralWei = state.chainState.data.balance;
	effect();
	assert.equal(state.debtStr, '');
	assert.ok(state.autoMaxLoan);
	state.quoteReady = true;
	effect();
	assert.equal(state.debtStr, '123.45');
	assert.equal(state.autoMaxLoan, null);
	state.maxBorrowWei = 200000000000000000000n;
	effect();
	assert.equal(state.debtStr, '123.45');
});

test('existing loan values, including explicit zero, remain unchanged', () => {
	for (const debtStr of ['50', '0', '0.00']) {
		const { state, click } = harness({ debtStr });
		click();
		assert.equal(state.debtStr, debtStr);
		assert.equal(state.autoMaxLoan, null);
	}
});

test('unavailable collateral Max does not request an autofill', () => {
	for (const overrides of [
		{ pending: true }, { wallet: { connected: false } },
		{ chainState: { data: null } },
		{ chainState: { data: { balance: 1n }, isError: true } },
		{ chainState: { data: { balance: 0n } } },
	]) {
		const { state, click } = harness(overrides);
		click();
		assert.equal(state.autoMaxLoan, null);
		assert.equal(state.spyStr, undefined);
	}
});

test('pending autofill is cancelled by user input, wallet changes, errors or transactions', () => {
	for (const overrides of [
		{ debtStr: '25' }, { account: 'wallet-b' }, { wallet: { connected: false } },
		{ collateralWei: 2n }, { openingQuote: { isError: true } }, { pending: true },
	]) {
		const { state, effect } = harness({
			autoMaxLoan: { account: 'wallet-a', collateral: 1n }, collateralWei: 1n,
			quoteReady: true, ...overrides,
		});
		effect();
		assert.equal(state.autoMaxLoan, null);
		assert.equal(state.debtStr, overrides.debtStr ?? '');
	}
	for (const field of ['setSpyStr(event.target.value)', "setDebtStr(event.target.value.replaceAll(',', ''))"]) {
		assert.ok(source.includes(`setAutoMaxLoan(null);\n              ${field}`));
	}
});

test('no available borrowing capacity leaves the loan empty', () => {
	const { state, effect } = harness({
		autoMaxLoan: { account: 'wallet-a', collateral: 1n }, collateralWei: 1n,
		quoteReady: true, maxBorrowWei: 0n,
	});
	effect();
	assert.equal(state.debtStr, '');
	assert.equal(state.autoMaxLoan, null);
});
