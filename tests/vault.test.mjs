import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

// Execute the actual component handlers with controlled hooks, not a live wallet.
function fixture() {
	const state = [];
	let cursor = 0;
	function load(name) {
		const source = readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8');
		const { outputText } = ts.transpileModule(source, {
			compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
		});
		const exports = {};
		new Function('require', 'exports', outputText)((id) => {
			if (id.startsWith('./')) return load(id.slice(2));
			if (id === 'react') return {
				useState(initial) {
					const index = cursor++;
					if (state[index] === undefined) state[index] = initial;
					return [state[index], (value) => { state[index] = value; }];
				},
			};
			return require(id);
		}, exports);
		return exports;
	}
	const { Vault } = load('vault');
	return () => { cursor = 0; return Vault(); };
}

function elements(tree) {
	if (!tree || typeof tree !== 'object') return [];
	if (Array.isArray(tree)) return tree.flatMap(elements);
	return [tree, ...elements(tree.props?.children)];
}

const labelled = (tree, label) => elements(tree).find((element) => element.props?.['aria-label'] === label);

test('vault renders requested copy and only deposit/withdraw actions with unavailable data', () => {
	const html = renderToStaticMarkup(fixture()());
	assert.match(html, /Earn rewards with/);
	assert.match(html, /yFUSD share/);
	assert.match(html, /lorum ipsum/);
	assert.doesNotMatch(html, /Compound|Claim rewards|SPY Stability Pool/);
	assert.match(html, /Deposits and withdrawals are not enabled yet/);
	assert.match(html, /disabled=""[^>]*>Deposit FUSD/);
});

test('heading and amount icons toggle both assets without changing the amount', () => {
	const render = fixture();
	let tree = render();
	labelled(tree, 'FUSD to deposit').props.onChange({ target: { value: '12.345' } });
	labelled(tree, 'Vault asset FUSD. Switch to USDG').props.onClick();
	tree = render();
	assert.equal(labelled(tree, 'USDG to deposit').props.value, '12.345');
	labelled(tree, 'Amount asset USDG. Switch to FUSD').props.onClick();
	tree = render();
	assert.equal(labelled(tree, 'FUSD to deposit').props.value, '12.345');
});

test('withdraw selects the action, resets the amount and remains disabled', () => {
	const render = fixture();
	let tree = render();
	labelled(tree, 'FUSD to deposit').props.onChange({ target: { value: '12' } });
	const actions = labelled(tree, 'Vault action');
	elements(actions).find((element) => element.type === 'button' && element.props.children === 'Withdraw').props.onClick();
	tree = render();
	assert.equal(labelled(tree, 'FUSD to withdraw').props.value, '');
	assert.match(renderToStaticMarkup(tree), /disabled=""[^>]*>Withdraw FUSD/);
});
