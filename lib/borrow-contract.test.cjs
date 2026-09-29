const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

function loadTypeScriptModule(relativePath) {
  const filename = path.join(__dirname, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const contract = loadTypeScriptModule('borrow-contract.ts');

test('uses the canonical Robinhood testnet deployment', () => {
  assert.deepEqual(contract.CONTRACTS, {
    spyToken: '0x568dABdd832B43A5a457aeC2db8D15c7C0C792C0',
    spyChainlinkAggregator: '0x01923e86C24c09f75E2aed0a6c9491cf0830966d',
    metadataNft: '0x03C8fF583660b689b80DcF6331902AB518b21EAB',
    base: '0x93863e629f79ee44fdaa7f297b60d5eb3049b83e',
    boldToken: '0x4eb936ba9b0be99bc26b5d1aaca39ce7620ef1be',
    collateralRegistry: '0xe603b097bdb3ac3d81b1360b224cf6af69535d96',
    hintHelpers: '0x21d9f8f59f35281caa9f8fbe168dbe1c12280cd6',
    multiTroveGetter: '0xb5b3132cbc630872a65b3fa7561605619865dc00',
    activePool: '0x5667d89070754baa873e67138517a217e242d7ff',
    borrowerOperations: '0x22402645151e526040b84fa156a11f44974eb246',
    collSurplusPool: '0x99183d5ca52a56783e2e0c732e92c5c81de76f88',
    defaultPool: '0xc37d9e918690b6ae9c6d36d5565c5e57ab2c9ba4',
    gasPool: '0xb9e4e845b2d50f0ddacb317499247b80520ed1ba',
    sortedTroves: '0x7f076b371448b2805c070f77b57477b67017017f',
    stabilityPool: '0x607810eaa0dfff2e67abc3cba8919d03cf4916d0',
    troveManager: '0xd0199b724aff6e73ba3891bf15d6be0787b145db',
    troveNft: '0xac9716503258f3146c957c47489428831247cd1d',
    spyPriceFeed: '0xcdd362415fca36f14073d2bf17fe3ae112c6fbc4',
  });
  assert.equal(contract.ROBINHOOD_TESTNET_CHAIN_ID, 46630);
});

test('keeps the deployed openTrove ABI and argument order', () => {
  const openTrove = contract.borrowerOperationsAbi.find(
    (item) => item.type === 'function' && item.name === 'openTrove',
  );
  assert.deepEqual(
    openTrove.inputs.map((input) => input.type),
    ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'address', 'address'],
  );
  assert.deepEqual(
    openTrove.inputs.map((input) => input.name),
    ['owner', 'ownerIndex', 'collAmount', 'boldAmount', 'upperHint', 'lowerHint', 'annualInterestRate', 'maxUpfrontFee', 'addManager', 'removeManager', 'receiver'],
  );
});

test('keeps the deployed fee and sorted hint read signatures', () => {
  const fee = contract.hintHelpersAbi.find(
    (item) => item.type === 'function' && item.name === 'predictOpenTroveUpfrontFee',
  );
  const approx = contract.hintHelpersAbi.find(
    (item) => item.type === 'function' && item.name === 'getApproxHint',
  );
  const insert = contract.sortedTrovesAbi.find(
    (item) => item.type === 'function' && item.name === 'findInsertPosition',
  );
  assert.deepEqual(fee.inputs.map((input) => input.type), ['uint256', 'uint256', 'uint256']);
  assert.deepEqual(approx.inputs.map((input) => input.type), ['uint256', 'uint256', 'uint256', 'uint256']);
  assert.deepEqual(insert.inputs.map((input) => input.type), ['uint256', 'uint256', 'uint256']);
  assert.deepEqual(insert.outputs.map((output) => output.type), ['uint256', 'uint256']);
});

test('adds a bounded 10% buffer to the predicted upfront fee', () => {
  assert.equal(contract.maxUpfrontFee(100n), 111n);
  assert.equal(contract.maxUpfrontFee(0n), 0n);
});

test('liquidator compensation is paid in ETH rather than added to SPY approval', () => {
  assert.equal(contract.requiredSpyApproval(10n ** 18n), 10n ** 18n);
  assert.equal(contract.LIQUIDATOR_COMPENSATION_ETH, 37_500_000_000_000_000n);

  const openTrove = contract.borrowerOperationsAbi.find(
    (item) => item.type === 'function' && item.name === 'openTrove',
  );
  assert.equal(openTrove.stateMutability, 'payable');
});

test('enforces a 10 FUSD minimum loan', () => {
  assert.equal(contract.validateOpenTrove(0n, 10n * 10n ** 18n, 5n * 10n ** 15n), 'Enter SPY collateral.');
  assert.equal(contract.validateOpenTrove(10n ** 18n, 9n * 10n ** 18n, 5n * 10n ** 15n), 'Borrow at least 10 FUSD.');
  assert.equal(contract.validateOpenTrove(10n ** 18n, 10n * 10n ** 18n, 4n * 10n ** 15n), 'Choose an interest rate of at least 0.5%.');
  assert.equal(contract.validateOpenTrove(10n ** 18n, 10n * 10n ** 18n, 5n * 10n ** 15n), null);
});
