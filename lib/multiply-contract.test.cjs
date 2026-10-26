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
