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
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}

const apr = load('pool-apr.ts');
const P = 10n ** 36n;
const W = 10n ** 18n;
const DAY = 86_400;

test('realised APR annualises the yield paid per FUSD', () => {
  // 1% paid on every FUSD over 36.5 days is 10% a year.
  assert.ok(Math.abs(apr.realisedApr(0n, P / 100n, P, 36.5 * DAY) - 0.10) < 1e-9);
  // P below 1e36 after a liquidation: the same B move is a larger return.
  assert.ok(Math.abs(apr.realisedApr(0n, P / 100n, P / 2n, 36.5 * DAY) - 0.20) < 1e-9);
  assert.equal(apr.realisedApr(5n, 5n, P, DAY), 0);
  assert.equal(apr.realisedApr(0n, 1n, P, 0), null);
  assert.equal(apr.realisedApr(0n, 1n, 0n, DAY), null);
  assert.equal(apr.realisedApr(2n, 1n, P, DAY), null);
});

test('pending yield is folded into B so a window can end now', () => {
  // 10 FUSD pending across 1,000 deposited adds 1% of P.
  assert.equal(apr.effectiveB(7n, P, 10n * W, 1000n * W), 7n + P / 100n);
  assert.equal(apr.effectiveB(7n, P, 0n, 1000n * W), 7n);
  assert.equal(apr.effectiveB(7n, P, 10n * W, 0n), 7n);
});

test('a window starts at the last payout at or before its first block', () => {
  const points = [{ block: 10n }, { block: 20n }, { block: 30n }];
  assert.deepEqual(apr.pickBaseline(points, 25n), { point: { block: 20n }, full: true });
  assert.deepEqual(apr.pickBaseline(points, 20n), { point: { block: 20n }, full: true });
  // Pool younger than the window: earliest payout stands in, flagged.
  assert.deepEqual(apr.pickBaseline(points, 5n), { point: { block: 10n }, full: false });
  assert.equal(apr.pickBaseline([], 5n), null);
});

test('P at a block comes from the log, or is unknown before the first logged move', () => {
  assert.equal(apr.pAt([], 50n, P), P);
  const updates = [{ block: 10n, p: 9n }, { block: 30n, p: 8n }];
  assert.equal(apr.pAt(updates, 20n, 7n), 9n);
  assert.equal(apr.pAt(updates, 30n, 7n), 8n);
  assert.equal(apr.pAt(updates, 5n, 7n), null);
});
