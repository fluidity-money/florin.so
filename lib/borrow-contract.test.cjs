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
    spyToken: '0x8823b40A23387Df76E127744FFB38b26eB012A5c',
    spyChainlinkAggregator: '0xcc794A65915A7Ec2B4753bB9d6b983C60035cd74',
    metadataNft: '0x09F7156AAE9C903F90B1CB1E312582C4f208A759',
    base: '0x79070369bf7539483a9a0a256b7d126e4b03a6a7',
    boldToken: '0xfc3e6bd02605f609f962a1e13705e5d9a21b206b',
    collateralRegistry: '0xade0b1fee76e3016f8d3e364b9da25c5648f286c',
    hintHelpers: '0x5c65d65df809fe09f88985f0ed74430688f92d84',
    multiTroveGetter: '0x6c98a67d418d79728581958ecd2aba530a12d64a',
    activePool: '0x4fb3f66bbeec447f000731cac3a6d96f892286a8',
    borrowerOperations: '0x90e8728f7a4ec88469a1df0e85ffbacd4895a0d6',
    collSurplusPool: '0x1eb6f459e4150cfe85f029bdb20cc7a4a81e1628',
    defaultPool: '0x9a32a9f41517958b48e884ee1be7af7d5e653595',
    gasPool: '0xa8b0ffd5bc8f32ca5ad30d6d9fbafcfbd8746d57',
    sortedTroves: '0x8cab45712316e93b27d514e23be7c246a9d97d20',
    stabilityPool: '0xfd90a40cfc4825621debef6c2a3b9ff15c44e286',
    troveManager: '0xab8cc5790a0b8cc4cd40f1be0c239e568b028b6b',
    troveNft: '0x52e8127cc9e0c8fbf4cff05036c5a7fdbabd7545',
    spyPriceFeed: '0xd504f01637b349b079ecfd921a6eece16d17d146',
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

test('uses fetchPrice and refuses prices carrying a new oracle failure', () => {
  const fetchPrice = contract.priceFeedAbi.find(
    (item) => item.type === 'function' && item.name === 'fetchPrice',
  );
  assert.equal(fetchPrice.stateMutability, 'nonpayable');
  assert.deepEqual(fetchPrice.outputs.map((output) => output.type), ['uint256', 'bool']);

  assert.equal(contract.validatedOraclePrice([77_227_200_000_000_000_000n, false]), 77_227_200_000_000_000_000n);
  assert.throws(
    () => contract.validatedOraclePrice([600_000_000_000_000_000_000n, true]),
    /oracle reported a new failure/i,
  );
  assert.throws(() => contract.validatedOraclePrice([0n, false]), /invalid price/i);
});

test('keeps the deployed position-management ABI and fee quote signatures', () => {
  const functions = new Map(
    contract.borrowerOperationsAbi
      .filter((item) => item.type === 'function')
      .map((item) => [item.name, item]),
  );
  assert.deepEqual(functions.get('addColl').inputs.map((input) => input.type), ['uint256', 'uint256']);
  assert.deepEqual(functions.get('withdrawColl').inputs.map((input) => input.type), ['uint256', 'uint256']);
  assert.deepEqual(functions.get('withdrawBold').inputs.map((input) => input.type), ['uint256', 'uint256', 'uint256']);
  assert.deepEqual(functions.get('repayBold').inputs.map((input) => input.type), ['uint256', 'uint256']);
  assert.deepEqual(functions.get('adjustTroveInterestRate').inputs.map((input) => input.type), ['uint256', 'uint256', 'uint256', 'uint256', 'uint256']);
  assert.deepEqual(functions.get('closeTrove').inputs.map((input) => input.type), ['uint256']);

  const feeFunctions = new Map(
    contract.hintHelpersAbi
      .filter((item) => item.type === 'function')
      .map((item) => [item.name, item]),
  );
  assert.deepEqual(feeFunctions.get('predictAdjustTroveUpfrontFee').inputs.map((input) => input.type), ['uint256', 'uint256', 'uint256']);
  assert.deepEqual(feeFunctions.get('predictAdjustInterestRateUpfrontFee').inputs.map((input) => input.type), ['uint256', 'uint256', 'uint256']);
});

test('validates position amounts and keeps repayment above minimum debt', () => {
  assert.equal(contract.validatePositionAmount('deposit', 0n, 10n), 'Enter an amount to deposit.');
  assert.equal(contract.validatePositionAmount('deposit', 11n, 10n), 'You do not have enough SPY.');
  assert.equal(contract.validatePositionAmount('withdraw', 11n, 10n), 'The position does not have that much SPY.');
  assert.equal(contract.validatePositionAmount('repay', 11n, 10n), 'You do not have enough FUSD.');
  assert.equal(contract.validatePositionAmount('borrow', 1n, 10n), null);
  assert.equal(contract.maxRepayableDebt(30n * 10n ** 18n), 20n * 10n ** 18n);
  assert.equal(contract.maxRepayableDebt(10n * 10n ** 18n), 0n);
});

test('adds a bounded 10% buffer to the predicted upfront fee', () => {
  assert.equal(contract.maxUpfrontFee(100n), 111n);
  assert.equal(contract.maxUpfrontFee(0n), 0n);
});

test('converts fractional display-percent rates to WAD without integer coercion', () => {
  assert.equal(contract.annualRateFromDisplayPercent('5.25%'), 52_500_000_000_000_000n);
  assert.equal(contract.annualRateFromDisplayPercent(' 5.25 % '), 52_500_000_000_000_000n);
  assert.equal(contract.annualRateFromDisplayPercent('0.5'), 5_000_000_000_000_000n);
  assert.equal(contract.annualRateFromDisplayPercent('not-a-rate'), null);
  assert.equal(contract.annualRateFromDisplayPercent('%'), null);
});

test('reserves the predicted upfront fee when calculating maximum borrowing', () => {
  assert.equal(contract.maxBorrowPrincipal(150n, 100n, 7n), 43n);
  assert.equal(contract.maxBorrowPrincipal(100n, 100n, 7n), 0n);
  assert.equal(contract.maxBorrowPrincipal(105n, 100n, 7n), 0n);
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
