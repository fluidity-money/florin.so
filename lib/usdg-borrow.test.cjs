const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relativePath, dependencies = {}) {
	const filename = path.join(__dirname, relativePath);
	const mod = new Module(filename, module);
	mod.filename = filename;
	mod.paths = Module._nodeModulePaths(__dirname);
	mod.require = name => dependencies[name] ?? Module.prototype.require.call(mod, name);
	mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
	}).outputText, filename);
	return mod.exports;
}

const contracts = load('borrow-contract.ts');
const { CONTRACTS } = contracts;
const state = { blockNumber: 123n, blockHash: '0x123' };
const { readUsdgOpeningState, USDG, USDG_ZAPPER } = load('usdg-borrow.ts', {
	'./borrow-contract': contracts,
	'./opening-capacity': {
		readOpeningState: async () => state,
		requireOpeningQuote: result => result.data,
	},
});
const exchange = '0xf7ab3619841813FFdb84aE0c8cAA2E31573d53d2';
const oracle = '0xD3F55480CFC3B3a47084d7E8c82a430a128aDf4b';
const wiring = [
	[USDG_ZAPPER, 'exchange', exchange],
	[USDG_ZAPPER, 'usdg', USDG],
	[USDG_ZAPPER, 'boldToken', CONTRACTS.boldToken],
	[USDG_ZAPPER, 'troveManager', CONTRACTS.troveManager],
	[USDG_ZAPPER, 'collToken', CONTRACTS.spyToken],
	[USDG_ZAPPER, 'borrowerOperations', CONTRACTS.borrowerOperations],
	[USDG_ZAPPER, 'WETH', CONTRACTS.weth],
	[exchange, 'boldToken', CONTRACTS.boldToken],
	[exchange, 'collToken', USDG],
	[exchange, 'priceFeed', oracle],
];

function clientFor(overrides = {}) {
	const values = new Map([
		...wiring,
		[exchange, 'priceScale', 1n],
		[exchange, 'oracleScale', 100_000_000n],
		[USDG, 'decimals', 18],
		[CONTRACTS.boldToken, 'decimals', 18],
		[oracle, 'decimals', 8],
		[oracle, 'latestRoundData', [1n, 100_000_000n, 1n, 1n, 1n]],
		[USDG, 'balanceOf', 100n],
		[CONTRACTS.boldToken, 'allowance', 200n],
	].map(([address, name, value]) => [`${address}:${name}`, value]));
	return {
		getChainId: async () => 46630,
		readContract: async ({ address, functionName, blockNumber }) => {
			assert.equal(blockNumber, state.blockNumber);
			const key = `${address}:${functionName}`;
			assert.ok(values.has(key), key);
			return overrides[key] ?? values.get(key);
		},
		getBlock: async ({ blockNumber }) => {
			assert.equal(blockNumber, state.blockNumber);
			return { hash: state.blockHash, timestamp: 2n };
		},
	};
}

test('USDG snapshot accepts case-insensitive wiring and preserves the block-pinned swap', async () => {
	const overrides = Object.fromEntries(wiring.map(([address, name, value]) => [
		`${address}:${name}`, value.toUpperCase(),
	]));
	assert.deepEqual(await readUsdgOpeningState(clientFor(overrides)), {
		...state,
		swap: { decimals: 18, answer: 100_000_000n, priceScale: 1n, oracleScale: 100_000_000n, liquidity: 100n, allowance: 200n },
	});
});

for (const [address, name] of wiring) {
	test(`USDG snapshot rejects mismatched ${address}:${name} before scale validation`, async () => {
		await assert.rejects(readUsdgOpeningState(clientFor({
			[`${address}:${name}`]: '0x0000000000000000000000000000000000000000',
			[`${exchange}:priceScale`]: 0n,
		})), { message: 'USDG zapper or exchange wiring does not match the SPY branch.' });
	});
}
