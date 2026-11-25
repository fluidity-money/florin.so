const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

function load(name, mocks = {}) {
	const filename = path.resolve(__dirname, name);
	const mod = new Module(filename, module);
	mod.filename = filename;
	mod.paths = Module._nodeModulePaths(__dirname);
	const original = mod.require.bind(mod);
	mod.require = (id) => {
		if (id in mocks) return mocks[id];
		if (id === './borrow-contract') return load('borrow-contract.ts');
		return original(id);
	};
	mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
	}).outputText, filename);
	return mod.exports;
}
const c = load('safety-mode.ts');
const W = 10n ** 18n;

test('strict CCR boundary, empty branch and exact bigint precision', () => {
	assert.equal(c.isBelowCriticalRatio(150n * W - 1n, 100n * W, W, 15n * W / 10n), true);
	assert.equal(c.isBelowCriticalRatio(150n * W, 100n * W, W, 15n * W / 10n), false);
	assert.equal(c.isBelowCriticalRatio(150n * W + 1n, 100n * W, W, 15n * W / 10n), false);
	assert.equal(c.isBelowCriticalRatio(0n, 0n, W, W), false);
	assert.throws(() => c.isBelowCriticalRatio(W, W, 0n, W), /Invalid/);
	assert.throws(() => c.isBelowCriticalRatio(W, W, W, 0n), /Invalid/);
});

function client({ failure = false, price = W, reorg = false, rpcError = false } = {}) {
	return {
		async getBlock(args) {
			return { number: 123n, hash: reorg && args.blockNumber ? 'changed' : 'canonical' };
		},
		async readContract(args) {
			assert.equal(args.blockNumber, 123n);
			if (rpcError) throw new Error('RPC failed');
			return { CCR: 15n * W / 10n, getEntireBranchColl: 140n * W, getEntireBranchDebt: 100n * W }[args.functionName];
		},
		async simulateContract(args) {
			assert.equal(args.blockNumber, 123n);
			assert.equal(args.functionName, 'fetchPrice');
			return { result: [price, failure] };
		},
	};
}

test('coherent live branch reads and oracle validation', async () => {
	assert.equal((await c.readSafetyMode(client())).active, true);
	await assert.rejects(c.readSafetyMode(client({ failure: true })), /oracle reported/);
	await assert.rejects(c.readSafetyMode(client({ price: 0n })), /invalid price/);
	await assert.rejects(c.readSafetyMode(client({ reorg: true })), /block changed/);
	await assert.rejects(c.readSafetyMode(client({ rpcError: true })), /RPC failed/);
});

test('only fresh active safety mode shows a notice', () => {
	assert.equal(c.safetyModeNotice(undefined, false, 1000), null);
	assert.equal(c.safetyModeNotice(undefined, true, 1000), null);
	assert.equal(c.safetyModeNotice({ active: false, readAt: 1000 }, false, 1000), null);
	assert.match(c.safetyModeNotice({ active: true, readAt: 1000 }, false, 1000), /Safety mode is active/);
	for (const active of [false, true]) {
		assert.equal(c.safetyModeNotice({ active, readAt: 1000 }, true, 1000), null);
		assert.equal(c.safetyModeNotice({ active, readAt: 1000 }, false, 31001), null);
		assert.equal(c.safetyModeNotice({ active, readAt: 1000 }, false, 999), null);
	}
});

test('actual banner renders active mode but hides unavailable status', () => {
	const React = require('react');
	const { renderToStaticMarkup } = require('react-dom/server');
	let query;
	const { SafetyModeBanner } = load('../components/safety-mode-banner.tsx', {
		'../lib/borrow-contract': { CONTRACTS: { borrowerOperations: 'branch', spyPriceFeed: 'oracle' } },
		'../lib/robinhood-client': { robinhoodPublicClient: { chain: { id: 1 } } },
		'../lib/safety-mode': c,
		'@tanstack/react-query': { useQuery(options) { assert.equal(options.refetchInterval, 15000); return query; } },
	});
	query = { data: { active: true, readAt: Date.now() }, isError: false };
	let html = renderToStaticMarkup(React.createElement(SafetyModeBanner));
	assert.match(html, /Safety mode is active/);
	assert.match(html, /role="status"/);
	query = { data: { active: false, readAt: Date.now() }, isError: false };
	assert.doesNotMatch(renderToStaticMarkup(React.createElement(SafetyModeBanner)), /safety-mode-banner/);
	for (const data of [undefined, { active: false, readAt: Date.now() }, { active: true, readAt: Date.now() }]) {
		query = { data, isError: true };
		assert.doesNotMatch(renderToStaticMarkup(React.createElement(SafetyModeBanner)), /safety-mode-banner|unavailable/);
	}
	assert.match(fs.readFileSync(path.join(__dirname, '../app/layout.tsx'), 'utf8'), /<Header \/>\s*<SafetyModeBanner \/>\s*<main/);
});
