import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

// Render the actual presentation component; no wallet or live RPC is involved.
function load(name) {
	const source = readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8');
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
	});
	const exports = {};
	new Function('require', 'exports', outputText)((id) => {
		if (id.startsWith('./')) return load(id.slice(2));
		return require(id);
	}, exports);
	return exports;
}

const { Vault } = load('vault');
const html = renderToStaticMarkup(Vault());

test('vault overview renders both strategy pairs with their mock metrics', () => {
	assert.match(html, /Vault strategies/);
	assert.match(html, /scope="col">Strategy/);
	assert.match(html, /scope="col">Estimated APY/);
	assert.match(html, /scope="col">TVL/);
	const rows = html.match(/<tr>.*?<\/tr>/g);
	assert.equal(rows.length, 3);
	assert.match(rows[1], /USDG\/FUSD.*8\.42%.*\$1,245,000/);
	assert.match(rows[2], /SPY\/FUSD.*12\.68%.*\$836,500/);
	assert.equal((html.match(/scope="row"/g) || []).length, 2);
});

test('mock values are disclosed and no transaction form remains', () => {
	assert.match(html, /aria-describedby="vault-preview"/);
	assert.match(html, /APY and TVL are illustrative, not live/);
	assert.match(html, /Deposits and withdrawals are not enabled yet/);
	assert.doesNotMatch(html, /<button|<input|<form|Your vault position|lorum ipsum|yFUSD/);
});

test('strategy token artwork and mobile metric labels are present', () => {
	assert.match(html, /src="\/usdg-token.png"/);
	assert.match(html, /src="\/spy-token.png"/);
	assert.equal((html.match(/tok-icon--fusd/g) || []).length, 2);
	assert.equal((html.match(/class="vault__mobile-label" aria-hidden="true"/g) || []).length, 4);
});
