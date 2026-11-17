import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
function loadComponent(name) {
	const source = read(`../components/${name}.tsx`);
	const { outputText } = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } });
	const exports = {};
	new Function('require', 'exports', outputText)((id) => id === './token-icon' ? loadComponent('token-icon') : require(id), exports);
	return exports;
}
const { LoanTokenToggle } = loadComponent('loan-token-toggle');
const form = read('../components/open-position-form.tsx');
const css = read('../app/globals.css');
const props = { value: 'FUSD', intro: true, disabled: false, onChange() {}, onIntroEnd() {} };

test('intro is an aria-hidden seven-row reel ending on FUSD without selecting anything', () => {
	let changes = 0;
	let ended = 0;
	const tree = LoanTokenToggle({ ...props, onChange: () => changes++, onIntroEnd: () => ended++ });
	const reel = tree.props.children.props.children;
	assert.deepEqual(reel.props.children.map((row) => row.props.children[1]), ['FUSD', 'USDG', 'FUSD', 'USDG', 'FUSD', 'USDG', 'FUSD']);
	reel.props.onAnimationEnd();
	assert.equal(ended, 1);
	assert.equal(changes, 0);
	const html = renderToStaticMarkup(tree);
	assert.match(html, /type="button"/);
	assert.match(html, /aria-label="Loan token FUSD. Switch to USDG"/);
	assert.match(html, /aria-hidden="true"/);
});

test('PostHog spin flag defaults off and only gates the decorative intro', () => {
	assert.match(form, /const enableLoanTokenSpin = useFeature\('enable-loan-token-spin', false\)/);
	const expression = form.match(/intro=\{([^}]+)\}/)[1];
	const intro = new Function('enableLoanTokenSpin', 'loanTokenIntro', `return ${expression}`);
	for (const enabled of [undefined, false, true]) {
		for (const eligible of [false, true]) {
			const changes = [];
			const tree = LoanTokenToggle({ ...props, intro: intro(enabled, eligible), onChange: token => changes.push(token) });
			assert.equal(renderToStaticMarkup(tree).includes('reel--intro'), enabled === true && eligible);
			tree.props.onClick();
			assert.deepEqual(changes, ['USDG']);
		}
	}
	// Flag loading or disabling cannot force animation; completion/selection stays final.
	assert.equal(Boolean(intro(false, true)), false);
	assert.equal(intro(true, true), true);
	assert.equal(intro(true, false), false);
});

test('explicit toggles work in both directions, but never while pending', () => {
	for (const value of ['FUSD', 'USDG']) {
		for (const disabled of [false, true]) {
			const changes = [];
			const tree = LoanTokenToggle({ ...props, intro: false, value, disabled, onChange: (token) => changes.push(token) });
			tree.props.onClick();
			assert.equal(tree.props.disabled, disabled);
			assert.deepEqual(changes, disabled ? [] : [value === 'FUSD' ? 'USDG' : 'FUSD']);
			assert.doesNotMatch(renderToStaticMarkup(tree), /reel--intro/);
		}
	}
});

test('both controls share selection; even reselecting FUSD cancels intro without changing amounts', () => {
	assert.equal((form.match(/onChange=\{selectLoanToken\}/g) || []).length, 2);
	assert.match(form, /<LoanTokenToggle[\s\S]*?value=\{loanToken\}[\s\S]*?disabled=\{pending\}/);
	const body = form.match(/function selectLoanToken\(symbol: LoanToken\) \{([\s\S]*?)\n\t\}/)[1];
	for (const pending of [false, true]) {
		for (const symbol of ['FUSD', 'USDG']) {
			const state = { intro: true, token: 'FUSD', events: [] };
			new Function('symbol', 'pending', 'loanToken', 'setLoanTokenIntro', 'setLoanToken', 'captureEvent', body)(
				symbol, pending, state.token, (value) => { state.intro = value; },
				(value) => { state.token = value; }, (...args) => state.events.push(args),
			);
			assert.equal(state.intro, pending);
			assert.equal(state.token, pending ? 'FUSD' : symbol);
			assert.equal(state.events.length, !pending && symbol !== 'FUSD' ? 1 : 0);
		}
	}
	assert.doesNotMatch(body, /setDebtStr|setSpyStr|setAutoMaxLoan/);
	assert.match(form, /onIntroEnd=\{\(\) => setLoanTokenIntro\(false\)\}/);
	const submit = form.match(/<Button\s+variant="primary"[\s\S]*?\{submitLabel\}[\s\S]*?<\/Button>/)[0];
	assert.doesNotMatch(submit, /usdgSelected/);
	assert.match(submit, /void openTrove\(\)/);
});

test('zero interest is a labelled preview that cannot open a position', async () => {
	assert.match(form, /min=\{0\} max=\{MAX_RATE\}/);
	assert.match(form, /useFeature\('enable-0-percent-caret', false\)/);
	assert.match(form, /className="swap__zero-rate"[^>]*aria-hidden=\{!enableZeroPercentCaret\}/);
	const visibility = new Function('enableZeroPercentCaret', `return ${form.match(/visibility: (enableZeroPercentCaret[^}]+)/)[1]}`);
	for (const enabled of [false, undefined, true]) {
		assert.equal(visibility(enabled), enabled ? 'visible' : 'hidden');
	}
	const description = new Function('enableZeroPercentCaret', `return ${form.match(/aria-describedby=\{([^}]+)\}/)[1]}`);
	for (const enabled of [false, undefined, true]) {
		assert.equal(description(enabled), enabled ? 'zero-interest-rate-note' : undefined);
	}
	assert.match(form, /className="swap__zero-rate-caret" aria-hidden="true"/);
	assert.match(form, /0% interest rate positions/);
	const disabledExpression = form.match(/disabled=\{(rate === 0[^\n]+)\}/)[1];
	const disabled = new Function('rate', 'wallet', 'marketClosed', 'active', 'protocolError', 'unsafe', 'insufficientSpy', 'pending', 'chainReady', 'feeReady', 'chainState', 'openingQuote', `return ${disabledExpression}`);
	for (const connected of [false, true]) {
		assert.equal(disabled(0, { connected }, false, true, null, false, false, false, true, true, { isError: false }, { isError: false }), true);
		assert.equal(disabled(0.005, { connected }, false, true, null, false, false, false, true, true, { isError: false }, { isError: false }), false);
	}
	const label = new Function('rate', 'usdgSelected', 'buttonLabel', `return ${form.match(/const submitLabel = (.*);/)[1]}`);
	assert.match(label(0, false, 'Mint FUSD'), /coming soon/);
	assert.match(label(0, true, 'Mint FUSD'), /coming soon/);
	assert.equal(label(0.005, false, 'Mint FUSD'), 'Mint FUSD');
	// Execute the actual early guard without providing a wallet: it must return before accessing one.
	const guard = form.match(/async function openTrove\(\) \{([\s\S]*?)if \(!wallet.connected/)[1];
	await new Function('rate', `return (async () => { ${guard} throw new Error('guard bypassed'); })()`)(0);
	const selection = new Function('nextRate', 'rate', 'MIN_RATE', `return ${form.match(/setRate\((nextRate >[^;]+)\);/)[1]}`);
	assert.equal(selection(0.0025, 0, 0.005), 0.005);
	assert.equal(selection(0.0025, 0.005, 0.005), 0);
	assert.equal(selection(0, 0.005, 0.005), 0);
	assert.equal(selection(0.0075, 0.005, 0.005), 0.0075);
});

test('CSS clips vertical reel, finishes on FUSD, supports reduced motion and keyboard focus', () => {
	assert.match(css, /loan-token-toggle__window\s*\{[^}]*height: 1\.25em;[^}]*overflow: hidden;/);
	assert.match(css, /translateY\(-7\.5em\)/);
	assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.loan-token-toggle__reel--intro\s*\{\s*animation-duration: 0s;/);
	assert.match(css, /loan-token-toggle:focus-visible\s*\{[^}]*outline: 2px solid currentColor/);
});
