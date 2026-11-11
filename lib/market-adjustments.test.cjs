const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const { QueryClient } = require('@tanstack/react-query');

function load(name) {
  const filename = path.join(__dirname, name + '.ts');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(__dirname);
  const original = mod.require.bind(mod);
  mod.require = id => id.startsWith('./') ? load(id.slice(2)) : original(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return mod.exports;
}
const { applyMarketReceipt: apply, reconcileMarkets: reconcile, withMarketCheckpoint: checkpoint } = load('market-adjustments');
const snapshot = (pool = '100', block = '10') => checkpoint({
  borrowDetails: [{ collateral: { name: 'SPY' }, deposited: '1.5K', debtIssued: '200', avgRatePa: '5%' }],
  earnRewards: [{ collateral: { name: 'SPY' }, poolSize: pool, apr: '3%', coverage: '50%' }],
}, { florinIndexedBlock: block });
const receipt = (hash = 'deposit', block = 20n, status = 'success') => ({ transactionHash: hash, blockNumber: block, status });
const pool = data => data.earnRewards[0].poolSize;

test('confirmed deposit survives unchanged, changed, missing-metadata and partially indexed responses', () => {
  const base = snapshot();
  const optimistic = apply(base, base, receipt(), { poolSize: 25 });
  assert.equal(pool(optimistic), '125');
  for (const incoming of [snapshot(), snapshot('125', '19'), snapshot('999', '19'), snapshot('125', null)]) {
    assert.equal(reconcile(optimistic, incoming), optimistic);
  }
  const fresh = reconcile(optimistic, snapshot('137', '20'));
  assert.equal(pool(fresh), '137'); // authoritative totals, NOT 137 + 25
  assert.equal(fresh.marketSync.pending, false);
  assert.equal(reconcile(fresh, snapshot('100', '19')), fresh);
  const newer = reconcile(fresh, snapshot('140', '30'));
  assert.equal(reconcile(newer, snapshot('137', '20')), newer);
});

test('multiple deposits and withdrawals accumulate exactly once until all receipt blocks are indexed', () => {
  const base = snapshot();
  const first = apply(base, base, receipt(), { poolSize: 25 });
  const second = apply(first, base, receipt('withdraw', 22n), { poolSize: -10 });
  assert.equal(pool(second), '115');
  assert.equal(apply(second, base, receipt(), { poolSize: 25 }), second);
  assert.equal(reconcile(second, snapshot('125', '20')), second);
  assert.equal(pool(reconcile(second, snapshot('115', '22'))), '115');
});

test('reverted receipts and already-indexed successful receipts do not change totals', () => {
  const base = snapshot();
  assert.equal(apply(base, base, receipt('failed', 20n, 'reverted'), { poolSize: 50 }), base);
  const fresh = snapshot('125', '20');
  assert.equal(apply(fresh, base, receipt(), { poolSize: 25 }), fresh);
});

test('uses pre-submission baseline even when a response without sufficient proof already contains the action', () => {
  const base = snapshot();
  assert.equal(pool(apply(snapshot('125', '19'), base, receipt(), { poolSize: 25 })), '125');
});

test('known borrowing, collateral, repayment and close deltas update display strings without mutating baseline', () => {
  const base = snapshot();
  const opened = apply(base, base, receipt(), { deposited: 10, debtIssued: 30 });
  assert.equal(opened.borrowDetails[0].deposited, '1510');
  assert.equal(opened.borrowDetails[0].debtIssued, '230');
  const closed = apply(opened, opened, receipt('close', 21n), { deposited: -10, debtIssued: -30 });
  assert.equal(closed.borrowDetails[0].deposited, '1500');
  assert.equal(closed.borrowDetails[0].debtIssued, '200');
  assert.equal(base.borrowDetails[0].deposited, '1.5K');
});

test('shared QueryClient retains confirmed adjustment across navigation and in-flight stale fetch completion', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  const key = ['florin-markets'];
  const base = snapshot();
  client.setQueryData(key, base);
  let finish;
  const request = client.fetchQuery({ queryKey: key, queryFn: async () => {
    const incoming = await new Promise(resolve => { finish = resolve; });
    return reconcile(client.getQueryData(key), incoming);
  } });
  client.setQueryData(key, current => apply(current, base, receipt(), { poolSize: 25 }));
  finish(snapshot());
  await request;
  assert.equal(pool(client.getQueryData(key)), '125');
  // A second consumer/frontpage reads exactly the same query, not its SSR seed.
  assert.equal(pool(await client.ensureQueryData({ queryKey: key, initialData: snapshot(), queryFn: async () => snapshot() })), '125');
  client.clear();
});

test('invalid checkpoint metadata is never accepted as indexing evidence', () => {
  for (const block of [null, -1, 'oops', '-1', '1.5']) {
    assert.equal(snapshot('100', block).marketSync.indexedBlock, undefined);
  }
});
