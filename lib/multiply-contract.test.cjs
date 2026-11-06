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
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const multiply = loadTypeScriptModule('multiply-contract.ts');
const WAD = 10n ** 18n;

test('undeployed Multiply contracts default to zero while allowing deployment overrides', () => {
  const keys = ['NEXT_PUBLIC_LEVERAGE_ZAPPER_ADDRESS', 'NEXT_PUBLIC_MULTIPLY_QUOTER_ADDRESS'];
  const saved = keys.map((key) => process.env[key]);
  const zero = '0x0000000000000000000000000000000000000000';
  try {
    for (const key of keys) delete process.env[key];
    assert.deepEqual(loadTypeScriptModule('multiply-contract.ts').CONTRACTS, {
      leverageZapper: zero, exchangeHelpers: zero,
    });
    for (const key of keys) process.env[key] = '';
    assert.deepEqual(loadTypeScriptModule('multiply-contract.ts').CONTRACTS, {
      leverageZapper: zero, exchangeHelpers: zero,
    });
    const address = '0x1111111111111111111111111111111111111111';
    for (const key of keys) process.env[key] = address;
    assert.deepEqual(loadTypeScriptModule('multiply-contract.ts').CONTRACTS, {
      leverageZapper: address, exchangeHelpers: address,
    });
  } finally {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    });
  }
});

test('multiply sizing turns the selected multiplier into flash-loaned SPY', () => {
  assert.deepEqual(multiply.multiplyAmounts(10n * WAD, 20), {
    flashLoanAmount: 10n * WAD,
    totalCollateral: 20n * WAD,
  });
  assert.deepEqual(multiply.multiplyAmounts(10n * WAD, 15), {
    flashLoanAmount: 5n * WAD,
    totalCollateral: 15n * WAD,
  });
});

test('multiply sizing rejects empty and sub-1x positions', () => {
  const empty = { flashLoanAmount: 0n, totalCollateral: 0n };
  assert.deepEqual(multiply.multiplyAmounts(0n, 20), empty);
  assert.deepEqual(multiply.multiplyAmounts(10n * WAD, 9), empty);
});

test('the exact-output exchange quote receives a 0.5% ceiling', () => {
  assert.equal(multiply.addMultiplySlippage(6_000n * WAD), 6_030n * WAD);
  assert.equal(multiply.addMultiplySlippage(1n), 2n);
});

test('leverage zapper ABI preserves the canonical tuple order', () => {
  const open = multiply.leverageZapperAbi.find((item) => item.name === 'openLeveragedTroveWithRawETH');
  assert.equal(open.stateMutability, 'payable');
  assert.deepEqual(open.inputs[0].components.map((item) => item.name), [
    'owner', 'ownerIndex', 'collAmount', 'flashLoanAmount', 'boldAmount',
    'upperHint', 'lowerHint', 'annualInterestRate', 'batchManager',
    'maxUpfrontFee', 'addManager', 'removeManager', 'receiver',
  ]);
});

test('exchange helper uses the exact-output quote required by a flash loan', () => {
  const quote = multiply.exchangeHelpersAbi.find((item) => item.name === 'quoteExactOutput');
  assert.deepEqual(quote.inputs.map((item) => item.type), ['uint256', 'bool', 'address']);
});
