const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const { encodeAbiParameters, encodeEventTopics, parseAbiParameters } = require('viem');
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
const { createPositionCache, positionsFromReceipt, creationEventsAbi } = load('pending-positions');
const manager = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
function receipt(id = 123n) {
  const log = (eventName, types, values) => ({ address: manager,
    topics: encodeEventTopics({ abi: creationEventsAbi, eventName, args: { _troveId: id } }),
    data: encodeAbiParameters(parseAbiParameters(types), values) });
  return { status: 'success', blockNumber: 20n, logs: [
    log('TroveUpdated', 'uint256,uint256,uint256,uint256,uint256,uint256', [1005n * 10n**18n, 4n * 10n**18n, 3n, 5n * 10n**16n, 0n, 0n]),
    log('TroveOperation', 'uint8,uint256,uint256,uint256,int256,uint256,int256', [0, 5n * 10n**16n, 0n, 5n * 10n**18n, 1000n * 10n**18n, 0n, 4n * 10n**18n]),
  ] };
}
test('real manager receipt supplies ID, final collateral, fee-inclusive debt and correct rate', () => {
  const [p] = positionsFromReceipt(owner, manager, receipt());
  assert.equal(p.troveId, '123'); assert.equal(p.debtFUSD, 1005);
  assert.equal(p.collateralSPY, 4); assert.equal(p.rate, .05);
  assert.deepEqual(positionsFromReceipt(owner, owner, receipt()), []);
  assert.deepEqual(positionsFromReceipt(owner, manager, { ...receipt(), status: 'reverted' }), []);
  assert.deepEqual(positionsFromReceipt(owner, manager, { ...receipt(), logs: [] }), []);
  assert.deepEqual(positionsFromReceipt(owner, manager, { ...receipt(), logs: receipt().logs.slice(0, 1) }), []);
});
test('shared cache survives navigation/unsubscribe, duplicates, stale and missing metadata; wallets isolated', () => {
  const cache = createPositionCache(); let changes = 0;
  const unsubscribe = cache.subscribe(() => changes++);
  cache.confirm(owner, manager, receipt()); unsubscribe();
  cache.confirm(owner, manager, receipt());
  cache.confirm(owner, manager, receipt(124n));
  cache.reconcile(owner, [], { florinIndexedBlock: '19' });
  cache.reconcile(owner, []);
  assert.equal(cache.get(owner).length, 2);
  assert.equal(cache.get(owner.toUpperCase()).length, 2);
  assert.equal(cache.get(manager).length, 0); assert.equal(cache.get(null).length, 0);
  assert.equal(changes, 1);
});
test('authoritative row replaces pending without duplication; older responses cannot undo reconciliation', () => {
  const cache = createPositionCache(); cache.confirm(owner, manager, receipt());
  const authoritative = { ...cache.get(owner)[0], debtFUSD: 1006 };
  cache.reconcile(owner, [authoritative], { florinIndexedBlock: '20' });
  assert.deepEqual(cache.get(owner), [authoritative]);
  cache.reconcile(owner, [], { florinIndexedBlock: '19' });
  cache.reconcile(owner, []);
  assert.deepEqual(cache.get(owner), [authoritative]);
  cache.reconcile(owner, [], { florinIndexedBlock: '21' });
  assert.deepEqual(cache.get(owner), []);
  cache.confirm(owner, manager, receipt()); assert.deepEqual(cache.get(owner), []);
});
test('checkpoint can prove newly created position no longer active; partial checkpoint retains later creation', () => {
  const cache = createPositionCache(); cache.confirm(owner, manager, receipt());
  cache.confirm(owner, manager, { ...receipt(124n), blockNumber: 22n });
  cache.reconcile(owner, [], { florinIndexedBlock: '20' });
  assert.deepEqual(cache.get(owner).map(p => p.troveId), ['124']);
  cache.reconcile(owner, [], { florinIndexedBlock: '22' }); assert.deepEqual(cache.get(owner), []);
});
test('already present row without checkpoint retires pending but still rejects older snapshots', () => {
  const cache = createPositionCache(); cache.confirm(owner, manager, receipt());
  const row = cache.get(owner)[0]; cache.reconcile(owner, [row]);
  cache.reconcile(owner, [], { florinIndexedBlock: '19' }); assert.deepEqual(cache.get(owner), [row]);
});
