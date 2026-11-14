const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
function load(name) {
  const filename = path.join(__dirname, name);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(__dirname);
  const original = mod.require.bind(mod);
  mod.require = (id) => id === './borrow-contract' ? load('borrow-contract.ts') : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const c = load('opening-capacity.ts');
const W = 10n ** 18n;
const S = c.OPENING_STEP;
const MIN = 1000n * W;
const feeFor = (p, d, a, r) => p * ((a + p * r) / (d + p)) * 7n / 365n / W;
const base = { price: 100n * W, mcr: 11n * W / 10n, ccr: 15n * W / 10n, collateral: 1000n * W, debt: 50000n * W };

test('capacity takes min of individual and post-deposit entire branch capacity, clamps zero', () => {
  assert.equal(c.openingDebtCapacity(base, 20n * W), 20n * W * 100n * W / base.mcr);
  const tight = { ...base, debt: 67000n * W };
  assert.equal(c.openingDebtCapacity(tight, 20n * W), 1000n * W);
  assert.equal(c.openingDebtCapacity({ ...tight, debt: tight.debt + W }, 20n * W), 999n * W);
  assert.equal(c.openingDebtCapacity({ ...base, debt: 100000n * W }, W), 0n);
  assert.equal(c.openingDebtCapacity({ ...base, collateral: 0n, debt: 0n }, 30n * W), 2000n * W);
  assert.throws(() => c.openingDebtCapacity({ ...base, price: 0n }, W), /Invalid/);
});

test('exact nonlinear fee Max: actual candidate fits, next cent cannot fit; no fee approximation', async () => {
  for (const d of [0n, 100n * W, 1000000n * W]) {
    for (const average of [0n, W / 200n, 2n * W]) {
      for (const rate of [W / 200n, W / 10n, 25n * W / 10n]) {
        const a = d * average;
        const cap = 7891n * W + 123n;
        let calls = 0;
        const predict = async (p) => { calls++; return feeFor(p, d, a, rate); };
        const max = await c.solveOpeningMax(cap, d, a, rate, predict);
        assert.equal(max % S, 0n);
        assert.ok(max + await predict(max) <= cap);
        assert.ok(max + S + await predict(max + S) > cap);
        assert.ok(calls <= 4, `RPC calls: ${calls}`);
      }
    }
  }
});

test('bigint formatting never rounds up or loses large-integer precision', () => {
  assert.equal(c.formatOpeningMax(123456789012345678901234567890123456789n), '123456789012345678901.23');
  assert.equal(c.formatOpeningMax(S - 1n), '0.00');
  assert.equal(c.formatOpeningMax(100n * S + S - 1n), '1.00');
});

test('minimum applies to principal plus fee; impossible cent and below-min capacity return zero', async () => {
  const rate = W / 10n;
  assert.equal(c.validateOpeningAmount(W, MIN - W, rate, W, MIN), null);
  assert.match(c.validateOpeningAmount(W, MIN - W, rate, W - 1n, MIN), /Total debt/);
  assert.match(c.validateOpeningAmount(W, MIN, rate, 1n, MIN), /limit/);
  assert.equal(await c.solveOpeningMax(MIN - 1n, 0n, 0n, rate, async () => 0n), 0n);
  assert.equal(await c.solveOpeningMax(MIN, 0n, 0n, 1n, async () => 1n), 0n);
  assert.equal(await c.solveOpeningMax(MIN, 0n, 0n, 1n, async () => 0n), MIN);
});

test('fee rounding can be nonmonotone: envelope still finds highest feasible cent', async () => {
  // Huge balances amplify a one-unit drop in the rounded average rate.
  const d = 10n ** 37n, a = d * W, r = W / 200n;
  const k = W / 2n;
  const boundary = (a - k * d) / (k - r) + 1n;
  assert.ok(feeFor(boundary, d, a, r) < feeFor(boundary - 1n, d, a, r));
  const p = 10n ** 36n;
  const cap = p + feeFor(p, d, a, r);
  const max = await c.solveOpeningMax(cap, d, a, r, async x => feeFor(x, d, a, r));
  assert.ok(max >= p);
  assert.ok(max + feeFor(max, d, a, r) <= cap);
  assert.ok(max + S + feeFor(max + S, d, a, r) > cap);
});

test('solver fails closed on a failed fee read, model mismatch, or exhausted exact RPC budget', async () => {
  await assert.rejects(c.solveOpeningMax(2000n * W, 0n, 0n, W, async () => { throw new Error('RPC'); }), /RPC/);
  await assert.rejects(c.solveOpeningMax(2000n * W, 0n, 0n, W, async () => 0n), /model changed/);
  let calls = 0;
  await assert.rejects(c.solveOpeningMax(2000n * W, 0n, 0n, W, async () => { calls++; return 2000n * W; }), /could not be resolved/);
  assert.equal(calls, 256);
});

function mockClient(overrides = {}) {
  const seen = [];
  const values = { MCR: base.mcr, CCR: base.ccr, getEntireBranchColl: base.collateral, getEntireBranchDebt: base.debt, activePool: '0x0000000000000000000000000000000000000001', hasBeenShutDown: false, isStockPaused: false, aggRecordedDebt: 49000n * W, calcPendingAggInterest: 1000n * W, aggWeightedDebtSum: 49000n * W * (W / 10n), ...overrides };
  const client = {
    async getBlock(args) { seen.push(['block', args]); return { number: 42n, hash: '0xabc' }; },
    async simulateContract(args) { seen.push(['oracle', args]); return { result: [base.price, false] }; },
    async readContract(args) {
      seen.push(['read', args]);
      if (values[args.functionName] instanceof Error) throw values[args.functionName];
      if (args.functionName === 'predictOpenTroveUpfrontFee') return feeFor(args.args[1], values.aggRecordedDebt + values.calcPendingAggInterest, values.aggWeightedDebtSum, args.args[2]);
      return values[args.functionName];
    },
  };
  return { client, seen, values };
}

test('live quote pins oracle, ratios, entire accrued branch debt and actual fees to one block', async () => {
  const { client, seen } = mockClient();
  const q = await c.quoteOpening(client, 20n * W, 1500n * W, W / 10n);
  assert.equal(q.debt, base.debt);
  assert.equal(q.feeDebt, 50000n * W);
  assert.equal(q.blockNumber, 42n);
  assert.ok(q.maxPrincipal > MIN);
  for (const [kind, args] of seen) if (kind !== 'block') assert.equal(args.blockNumber, 42n);
  assert.ok(seen.some(([, args]) => args.functionName === 'getEntireBranchDebt'));
  assert.ok(seen.some(([, args]) => args.functionName === 'predictOpenTroveUpfrontFee'));
});

test('failed reads, shutdown, rejected oracle and reorg fail closed', async () => {
  for (const name of ['MCR', 'CCR', 'getEntireBranchDebt', 'getEntireBranchColl', 'calcPendingAggInterest', 'predictOpenTroveUpfrontFee']) {
    const { client } = mockClient({ [name]: new Error('RPC failed') });
    await assert.rejects(c.quoteOpening(client, 20n * W, MIN, W / 10n), /RPC failed/);
  }
  await assert.rejects(c.quoteOpening(mockClient({ hasBeenShutDown: true }).client, W, MIN, W / 10n), /shut down/);
  const { client } = mockClient();
  client.simulateContract = async () => ({ result: [base.price, true] });
  await assert.rejects(c.quoteOpening(client, W, MIN, W / 10n));
  const reorg = mockClient().client;
  reorg.getBlock = async args => ({ number: 42n, hash: args.blockNumber ? 'changed' : 'original' });
  await assert.rejects(c.quoteOpening(reorg, W, MIN, W / 10n), /block changed/);
});

test('query lifecycle: cached failed and aged data cannot authorize; background fetching retains valid values', () => {
  const data = { readAt: 1000, capacity: MIN, fee: 0n };
  assert.throws(() => c.requireOpeningQuote({ data, isError: true }, 1001), /unavailable/);
  assert.throws(() => c.requireOpeningQuote({ data, isError: false }, 31001), /stale/);
  assert.throws(() => c.requireOpeningQuote({ isError: false }, 1001), /unavailable/);
  assert.equal(c.requireOpeningQuote({ data, isError: false, isFetching: true }, 1001), data);
});

test('submission refresh tolerates harmless accrual but bounds fees by reviewed tolerance and current capacity', () => {
  const previous = { capacity: 2000n * W, fee: W };
  const limit = W + W / 10n + 1n;
  assert.equal(c.reviewOpeningRefresh(previous, previous, W, MIN, W / 10n), limit);
  for (const fresh of [{ ...previous, capacity: previous.capacity + 1n }, { ...previous, capacity: previous.capacity - 1n }, { ...previous, fee: W + 1n }]) {
    assert.equal(c.reviewOpeningRefresh(previous, fresh, W, MIN, W / 10n), limit);
  }
  assert.equal(c.reviewOpeningRefresh(previous, { capacity: MIN + W, fee: W }, W, MIN, W / 10n), W);
  assert.throws(() => c.reviewOpeningRefresh(previous, { capacity: MIN, fee: W }, W, MIN, W / 10n), /limit/);
  assert.throws(() => c.reviewOpeningRefresh(previous, { ...previous, fee: limit + 1n }, W, MIN, W / 10n), /changed/);
});

test('a paused stock is read with the opening state and blocks submission before signing', async () => {
  const open = await c.readOpeningState(mockClient().client);
  assert.equal(open.stockPaused, false);
  const { client, seen } = mockClient({ isStockPaused: true });
  const paused = await c.quoteOpening(client, 20n * W, MIN, W / 10n);
  assert.equal(paused.stockPaused, true);
  assert.ok(seen.some(([kind, args]) => kind === 'read' && args.functionName === 'isStockPaused' && args.blockNumber === 42n));
  assert.throws(() => c.reviewOpeningRefresh(paused, paused, 20n * W, MIN, W / 10n), /SPY trading is paused/);
});

// Exercise the actual form query options with TanStack's cache and mocked RPCs.
function formQueries(client, queryClient, stateResult = {}, quoteResult = {}, deposit = 0n, principal = 0n, controls = {}) {
	const source = fs.readFileSync(path.join(__dirname, '../components/open-position-form.tsx'), 'utf8');
	const body = source.slice(source.indexOf('const openingStateKey ='), source.indexOf('  // Balance and allowance'));
	const options = [];
	const effects = [];
	const bindings = {
		...c, publicClient: client, queryClient, collateralWei: deposit, borrowedWei: principal, rateWei: W / 10n,
		ROBINHOOD_TESTNET_CHAIN_ID: 46630, CONTRACTS: { borrowerOperations: 'branch', spyPriceFeed: 'oracle' },
		useQuery: config => { options.push(config); return options.length === 1 ? stateResult : quoteResult; },
		useState: () => [0, () => {}], useEffect: effect => effects.push(effect),
		...controls,
	};
	const result = new Function(...Object.keys(bindings), `${body}; return { stateReady, quoteReady, openingKey };`)(...Object.values(bindings));
	return { ...result, options, effects };
}

test('form query cache: collateral edits, Max and borrowed update reuse one coherent oracle snapshot', async () => {
	const { QueryClient } = require('@tanstack/react-query');
	const cache = new QueryClient();
	try {
		const { client, seen } = mockClient();
		const initial = formQueries(client, cache);
		assert.equal(initial.options[1].enabled, false);
		const state = await cache.fetchQuery(initial.options[0]);
		const result = { data: state, isError: false };
		let principal = 0n;
		for (const deposit of [0n, 10n * W, 20n * W, 20n * W]) {
			const form = formQueries(client, cache, result, {}, deposit, principal);
			assert.equal(form.stateReady, true);
			assert.equal(form.quoteReady, false); // Price is ready while this amount's fees load.
			assert.equal(await cache.fetchQuery(form.options[0]), state);
			const quote = await cache.fetchQuery(form.options[1]);
			assert.equal(quote.blockHash, state.blockHash);
			assert.equal(quote.readAt, state.readAt); // Amount edits cannot renew freshness.
			assert.equal(formQueries(client, cache, result, { data: quote, isError: false }, deposit, principal).quoteReady, true);
			principal = quote.maxPrincipal; // Includes the second query caused by loan autofill.
		}
		assert.equal(seen.filter(([kind]) => kind === 'oracle').length, 1);
		assert.equal(seen.filter(([, args]) => args.functionName === 'MCR').length, 1);
		for (const [kind, args] of seen) if (kind !== 'block') assert.equal(args.blockNumber, state.blockNumber);
		// Both pre-signature and final transaction refreshes bypass the UI cache.
		await c.quoteOpening(client, 20n * W, principal, W / 10n);
		await c.quoteOpening(client, 20n * W, principal, W / 10n);
		assert.equal(seen.filter(([kind]) => kind === 'oracle').length, 3);
	} finally { cache.clear(); }
});

test('expiry refreshes state; stale/error snapshots cannot enable cached quotes or issue fee RPCs', async () => {
	const { QueryClient } = require('@tanstack/react-query');
	const cache = new QueryClient();
	const originalNow = Date.now;
	let now = originalNow();
	Date.now = () => now;
	try {
		const { client, seen } = mockClient();
		const state = await cache.fetchQuery(formQueries(client, cache).options[0]);
		const quote = await c.quoteOpeningFromState(client, state, 20n * W, MIN, W / 10n);
		const failed = formQueries(client, cache, { data: state, isError: true }, { data: quote, isError: false });
		assert.equal(failed.stateReady, false);
		assert.equal(failed.quoteReady, false);
		assert.equal(failed.options[1].enabled, false);
		now += c.OPENING_MAX_AGE_MS + 1;
		const stale = formQueries(client, cache, { data: state, isError: false }, { data: quote, isError: false });
		assert.equal(stale.quoteReady, false);
		const calls = seen.length;
		await assert.rejects(c.quoteOpeningFromState(client, state, 20n * W, MIN, W / 10n), /stale/);
		assert.equal(seen.length, calls);
		const fresh = await cache.fetchQuery(stale.options[0]);
		assert.equal(fresh.readAt, now);
		assert.equal(seen.filter(([kind]) => kind === 'oracle').length, 2);
		client.simulateContract = async () => { throw new Error('oracle unavailable'); };
		now += c.OPENING_MAX_AGE_MS + 1;
		await assert.rejects(cache.fetchQuery(stale.options[0]), /oracle unavailable/);
		assert.equal(cache.getQueryState(stale.options[0].queryKey).status, 'error');
	} finally { Date.now = originalNow; cache.clear(); }
});

test('expiry effect rerenders and requests refresh without cancelling an in-flight read; unmount cleans up', async () => {
	const { client } = mockClient();
	const state = await c.readOpeningState(client);
	let callback, delay, cleared, renders = 0, refreshes = 0;
	const form = formQueries(client, null, {
		data: state, isError: false,
		refetch: options => { assert.equal(options.cancelRefetch, false); refreshes++; },
	}, {}, 0n, 0n, {
		setTimeout: (fn, ms) => { callback = fn; delay = ms; return 123; },
		clearTimeout: id => { cleared = id; },
		useState: () => [0, () => { renders++; }],
	});
	const cleanup = form.effects[0]();
	assert.ok(delay > 0 && delay <= c.OPENING_MAX_AGE_MS + 1);
	callback();
	assert.equal(renders, 1);
	assert.equal(refreshes, 1);
	cleanup();
	assert.equal(cleared, 123);
});

test('reused state still rejects fee errors, reorgs and expiry during the quote', async () => {
	const { client, values } = mockClient();
	const state = await c.readOpeningState(client);
	values.predictOpenTroveUpfrontFee = new Error('fee unavailable');
	await assert.rejects(c.quoteOpeningFromState(client, state, 20n * W, MIN, W / 10n), /fee unavailable/);
	delete values.predictOpenTroveUpfrontFee;
	client.getBlock = async () => ({ number: 42n, hash: 'changed' });
	await assert.rejects(c.quoteOpeningFromState(client, state, 20n * W, MIN, W / 10n), /block changed/);
	const originalNow = Date.now;
	try {
		client.getBlock = async () => {
			Date.now = () => state.readAt + c.OPENING_MAX_AGE_MS + 1;
			return { number: 42n, hash: state.blockHash };
		};
		await assert.rejects(c.quoteOpeningFromState(client, state, 20n * W, MIN, W / 10n), /stale/);
	} finally { Date.now = originalNow; }
});

test('collateral alone autofocuses; oracle display depends on state rather than amount quote', () => {
	const source = fs.readFileSync(path.join(__dirname, '../components/open-position-form.tsx'), 'utf8');
	assert.match(source, /<input autoFocus[^>]*value=\{spyStr\}/);
	assert.equal((source.match(/autoFocus/g) || []).length, 1);
	assert.ok(source.includes('const priceReady = stateReady;'));
	assert.ok(source.includes('formatUnits(openingState.data.price, 18)'));
	assert.ok(source.includes('void openingState.refetch({ cancelRefetch: false })'));
	assert.ok(source.includes('openingState.data.readAt + OPENING_MAX_AGE_MS + 1 - Date.now()'));
});

test('normal opening wiring refreshes after approvals/hints and before both execution paths', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/open-position-form.tsx'), 'utf8');
  assert.equal((source.match(/const feeLimit = await refreshOpening\(\)/g) || []).length, 2);
  assert.ok(source.lastIndexOf('const feeLimit = await refreshOpening()') > source.lastIndexOf('The SPY approval transaction reverted'));
  assert.ok(source.includes('setDebtStr(formatOpeningMax(current.maxPrincipal))'));
  assert.ok(!source.includes('Math.floor(maxBorrow'));
  assert.ok(source.includes('validateOpeningAmount(collateralWei, borrowedWei, rateWei, quote.fee, quote.capacity)'));
  assert.ok(!source.includes('maxUpfrontFee(predictedFee)'));
});
