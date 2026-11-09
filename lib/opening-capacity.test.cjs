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
  const values = { MCR: base.mcr, CCR: base.ccr, getEntireBranchColl: base.collateral, getEntireBranchDebt: base.debt, activePool: '0x0000000000000000000000000000000000000001', hasBeenShutDown: false, aggRecordedDebt: 49000n * W, calcPendingAggInterest: 1000n * W, aggWeightedDebtSum: 49000n * W * (W / 10n), ...overrides };
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

test('normal opening wiring refreshes after approvals/hints and before both execution paths', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/open-position-form.tsx'), 'utf8');
  assert.equal((source.match(/const feeLimit = await refreshOpening\(\)/g) || []).length, 2);
  assert.ok(source.lastIndexOf('const feeLimit = await refreshOpening()') > source.lastIndexOf('The SPY approval transaction reverted'));
  assert.ok(source.includes('setDebtStr(formatOpeningMax(current.maxPrincipal))'));
  assert.ok(!source.includes('Math.floor(maxBorrow'));
  assert.ok(source.includes('validateOpeningAmount(collateralWei, borrowedWei, rateWei, quote.fee, quote.capacity)'));
  assert.ok(!source.includes('maxUpfrontFee(predictedFee)'));
});
