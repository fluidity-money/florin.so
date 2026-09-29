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
  assert.deepEqual(
    {
      spyToken: contract.CONTRACTS.spyToken,
      spyChainlinkAggregator: contract.CONTRACTS.spyChainlinkAggregator,
      metadataNft: contract.CONTRACTS.metadataNft,
      base: contract.CONTRACTS.base,
      boldToken: contract.CONTRACTS.boldToken,
      collateralRegistry: contract.CONTRACTS.collateralRegistry,
      hintHelpers: contract.CONTRACTS.hintHelpers,
      multiTroveGetter: contract.CONTRACTS.multiTroveGetter,
      activePool: contract.CONTRACTS.activePool,
    },
    {
      spyToken: '0xEa211c7b113fF27C9c80dcbAd1847Dd7689C9200',
      spyChainlinkAggregator: '0x78f183A12F9Eec11FF9503666a8D8694c707F1c5',
      metadataNft: '0x9C2813a0E185039FC1d05D2386C9a287275A3994',
      base: '0x95bef01290059c653b1872cc22747e02d3e35948',
      boldToken: '0x5019b8e5afa5f64e48e48696eec6c546984f7131',
      collateralRegistry: '0xa6d42d8b56315963e67dc253ef8173f1f2c3cd6f',
      hintHelpers: '0xea7a158f3d45f23ff11e999e329d4cda5beff3a4',
      multiTroveGetter: '0x80c64aa04f4f2b3b67c96b065dd6c1cf7187dcb4',
      activePool: '0x000786d49ff85eeffae93ed5be26b66743480e79',
    },
  );
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
