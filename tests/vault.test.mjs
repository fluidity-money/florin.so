import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
function load(file, hooks) {
	const path = resolve(root, file);
	const source = readFileSync(path, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
	});
	const exports = {};
	new Function('require', 'exports', outputText)((id) => {
		if (id.endsWith('.css')) return new Proxy({}, { get: (_, key) => key });
		if (id === 'react' && hooks) return { ...React, ...hooks };
		if (id.startsWith('.')) {
			const base = resolve(dirname(path), id);
			return load(existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`);
		}
		return require(id);
	}, exports);
	return exports;
}
const { Vault } = load('components/vault.tsx');
const html = renderToStaticMarkup(React.createElement(Vault));
const { MOCK_STRATEGIES, getMockStrategy, simulateVaultAction, mockChartValues } = load('lib/mock-vaults.ts');

// Execute actual callbacks with controlled hook state; this is not a browser harness.
function harness(file, name, props = {}) {
	const state = [];
	let cursor = 0;
	const hooks = {
		useState(initial) {
			const index = cursor++;
			if (!(index in state)) state[index] = initial;
			return [state[index], (value) => { state[index] = value; }];
		},
		useId: () => 'chart-summary',
	};
	const Component = load(file, hooks)[name];
	return () => { cursor = 0; return Component(props); };
}
function nodes(node, predicate) {
	if (!node || typeof node !== 'object') return [];
	const found = predicate(node) ? [node] : [];
	return found.concat(React.Children.toArray(node.props?.children).flatMap((child) => nodes(child, predicate)));
}
const button = (tree, label) => nodes(tree, (node) => node.type === 'button' && React.Children.toArray(node.props.children).join('') === label)[0];

test('overview retains paired metrics, artwork and native detail links without restoring intro', () => {
	const rows = html.match(/<tr>.*?<\/tr>/g);
	assert.equal(rows.length, 3);
	assert.match(rows[1], /USDG\/FUSD.*8\.42%.*\$1,245,000/);
	assert.match(rows[2], /SPY\/FUSD.*12\.68%.*\$836,500/);
	for (const slug of ['usdg-fusd', 'spy-fusd']) assert.match(html, new RegExp(`href="/vault/${slug}"`));
	assert.match(html, /src="\/usdg-token.png"/);
	assert.match(html, /src="\/spy-token.png"/);
	assert.equal((html.match(/scope="row"/g) || []).length, 2);
	assert.equal((html.match(/class="vault__mobile-label"/g) || []).length, 4);
	assert.doesNotMatch(html, /vault-preview|vault__intro|<input|<form/);
});

test('valid strategy routes share fixtures; invalid slugs fail closed and route keys reset client state', () => {
	assert.equal(getMockStrategy('invalid'), undefined);
	for (const strategy of MOCK_STRATEGIES) assert.equal(getMockStrategy(strategy.slug), strategy);
	const route = readFileSync(resolve(root, 'app/vault/[slug]/page.tsx'), 'utf8');
	assert.match(route, /if \(!strategy\) notFound\(\)/);
	assert.match(route, /key=\{strategy.slug\}/);
});

test('detail renders disclosure, metrics, simulator and all section buttons for each strategy', () => {
	const { VaultDetail } = load('components/vault-detail.tsx');
	for (const strategy of MOCK_STRATEGIES) {
		const markup = renderToStaticMarkup(React.createElement(VaultDetail, { strategy }));
		assert.ok(markup.includes(strategy.tvl));
		assert.ok(markup.includes(strategy.estimatedApy));
		assert.match(markup, /fictitious/);
		assert.match(markup, /Simulated balance/);
		assert.match(markup, /Simulate deposit/);
		for (const label of ['Performance', 'Vault info', 'Strategies', 'Risk']) assert.ok(markup.includes(label));
	}
});

test('each information button changes the rendered section', () => {
	const render = harness('components/vault-detail.tsx', 'VaultDetail', { strategy: MOCK_STRATEGIES[1] });
	for (const [label, content] of [['Vault info', 'Illustrative fee schedule'], ['Strategies', 'SPY/FUSD liquidity'], ['Risk', 'impermanent loss'], ['Performance', 'Mock performance']]) {
		button(render(), label).props.onClick();
		assert.match(renderToStaticMarkup(render()), new RegExp(content));
		assert.equal(button(render(), label).props['aria-pressed'], true);
	}
});

test('chart controls change actual points and accessible summaries', () => {
	const render = harness('components/vault-performance.tsx', 'VaultPerformance', { strategy: MOCK_STRATEGIES[0] });
	const points = () => nodes(render(), (node) => node.type === 'polyline')[0].props.points;
	const initial = points();
	button(render(), '90D').props.onClick();
	assert.notEqual(points(), initial);
	button(render(), 'TVL').props.onClick();
	assert.match(renderToStaticMarkup(render()), /90D TVL/);
	assert.notDeepEqual(mockChartValues(MOCK_STRATEGIES[0], 'APY', '7D'), mockChartValues(MOCK_STRATEGIES[0], 'APY', '30D'));
});

test('simulator rejects malformed, nonfinite, zero, negative and insufficient amounts', () => {
	const funds = { balance: 100000, position: 25000 };
	for (const amount of ['', '0', '-1', '1e2', 'NaN', 'Infinity', '1.001', '1001', '9'.repeat(400)]) {
		const result = simulateVaultAction(funds, 'deposit', amount);
		assert.equal(result.ok, false, amount);
		assert.deepEqual(result.state, funds);
	}
	assert.equal(simulateVaultAction(funds, 'withdraw', '250.01').ok, false);
	const deposited = simulateVaultAction(funds, 'deposit', '10.25');
	assert.deepEqual(deposited.state, { balance: 98975, position: 26025 });
	assert.deepEqual(simulateVaultAction(deposited.state, 'withdraw', '10.25').state, funds);
});

test('actual simulator Max, submit and withdraw callbacks update balances and inline feedback', () => {
	const render = harness('components/vault-simulator.tsx', 'VaultSimulator');
	const submit = () => nodes(render(), (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
	button(render(), 'Max').props.onClick();
	assert.equal(nodes(render(), (node) => node.type === 'input')[0].props.value, '1000.00');
	submit();
	assert.match(renderToStaticMarkup(render()), /1250\.00 FUSD/);
	assert.match(renderToStaticMarkup(render()), /No transaction was sent/);
	button(render(), 'Withdraw').props.onClick();
	button(render(), 'Max').props.onClick();
	submit();
	assert.match(renderToStaticMarkup(render()), /Simulated withdraw of 1250\.00/);
	assert.match(renderToStaticMarkup(render()), /Simulated position<\/dt><dd>0\.00 FUSD/);
});
