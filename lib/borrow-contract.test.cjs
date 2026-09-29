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
    spyToken: '0x2541F59c5e47cC36eE1368d0F8B96360791D708f',
    spyChainlinkAggregator: '0xEBb9A0c911100157D72267caADBA6bf29dA0eD92',
    metadataNft: '0x32b565eF0e3B00dff3c18E23E36f903bb54FEa61',
    base: '0x0814e4d204c9c61c265da5113779bf77d8038d0d',
    boldToken: '0xedf9b41837e4483271511ab709161b9db8c17bb1',
    collateralRegistry: '0x021444ce9725d4d8e3ad50fb3647cce75a625f90',
    hintHelpers: '0x6bd9c9c05dcf21c17d45a33baf6f840a57aacd30',
    multiTroveGetter: '0x819f60704798fc31ad8dacb52fb8f2fd96678b94',
    activePool: '0x3a896658cc2f148c398cf420b8f6fdcffd194eda',
    borrowerOperations: '0x20a52933ffa5e2a0f11a4cf9b6ee54d738a09dd2',
    collSurplusPool: '0x50f9a6220a3acae6c03949c79d27a2f3304a9775',
    defaultPool: '0x4c0e523df5ec6f258bfa8f452bc70de138ad7a6b',
    gasPool: '0xd586422af4ad16cbc868a075e578303c881e2a63',
    sortedTroves: '0x50bb405e5d09869346cdbeed0f0b3c4e0934ccdb',
    stabilityPool: '0xf272712ee53a49106a5d81d11cefc0cf408f1f7d',
    troveManager: '0xf7683ecd9342662d3c780291f32dec4a34ccbf02',
    troveNft: '0xb96cfd362e0d41a9c5c189b0c1ff12e2f4074af9',
    spyPriceFeed: '0x49b4d2a6a92f34653f81e5252146657e4abc72ee',
    weth: '0x7943e237c7F95DA44E0301572D358911207852Fa',
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

  const errorNames = contract.borrowerOperationsAbi
    .filter((item) => item.type === 'error')
    .map((item) => item.name);
  assert.ok(errorNames.includes('ICRBelowMCR'));
  assert.ok(errorNames.includes('DebtBelowMin'));
  assert.ok(errorNames.includes('UpfrontFeeTooHigh'));
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

test('liquidator compensation is wrapped to WETH rather than added to SPY approval', () => {
  assert.equal(contract.requiredSpyApproval(10n ** 18n), 10n ** 18n);
  assert.equal(contract.LIQUIDATOR_COMPENSATION_WETH, 1_000_000_000_000_000n);
  assert.equal(contract.requiredWethWrap(0n), 1_000_000_000_000_000n);
  assert.equal(contract.requiredWethWrap(750_000_000_000_000n), 250_000_000_000_000n);
  assert.equal(contract.requiredWethWrap(1_000_000_000_000_000n), 0n);
  assert.equal(contract.requiredWethWrap(2_000_000_000_000_000n), 0n);

  const openTrove = contract.borrowerOperationsAbi.find(
    (item) => item.type === 'function' && item.name === 'openTrove',
  );
  assert.equal(openTrove.stateMutability, 'nonpayable');

  const deposit = contract.wethAbi.find(
    (item) => item.type === 'function' && item.name === 'deposit',
  );
  assert.equal(deposit.stateMutability, 'payable');
});

test('enforces a 10 FUSD minimum loan', () => {
  assert.equal(contract.validateOpenTrove(0n, 10n * 10n ** 18n, 5n * 10n ** 15n), 'Enter SPY collateral.');
  assert.equal(contract.validateOpenTrove(10n ** 18n, 9n * 10n ** 18n, 5n * 10n ** 15n), 'Borrow at least 10 FUSD.');
  assert.equal(contract.validateOpenTrove(10n ** 18n, 10n * 10n ** 18n, 4n * 10n ** 15n), 'Choose an interest rate of at least 0.5%.');
  assert.equal(contract.validateOpenTrove(10n ** 18n, 10n * 10n ** 18n, 5n * 10n ** 15n), null);
});
