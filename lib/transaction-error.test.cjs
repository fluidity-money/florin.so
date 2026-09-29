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

const { describeTransactionError } = loadTypeScriptModule('transaction-error.ts');

test('explains when a wallet request was rejected by the user', () => {
  const result = describeTransactionError(
    { code: 4001, shortMessage: 'User rejected the request.' },
    'opening',
  );

  assert.equal(result.title, 'Transaction cancelled.');
  assert.equal(result.explanation, 'You rejected the request in your wallet. No transaction was submitted.');
  assert.equal(result.code, '4001');
});

test('shows a decoded contract reason below a reverted open-position error', () => {
  const result = describeTransactionError(
    {
      shortMessage: 'The contract function "openTrove" reverted.',
      cause: { reason: 'ICRBelowMCR' },
    },
    'opening',
  );

  assert.equal(result.title, 'Open position reverted.');
  assert.match(result.explanation, /collateral ratio is below the protocol minimum/i);
  assert.match(result.explanation, /ICRBelowMCR/);
  assert.match(result.technicalDetails, /openTrove/);
});

test('explains insufficient ETH for liquidator compensation and network fees', () => {
  const result = describeTransactionError(
    new Error('insufficient funds for gas * price + value'),
    'opening',
  );

  assert.equal(result.title, 'Not enough ETH.');
  assert.match(result.explanation, /0\.001 ETH.*wrap.*WETH/i);
  assert.match(result.explanation, /network fee/);
});

test('identifies WETH wrapping and approval reverts', () => {
  const wrapping = describeTransactionError(new Error('execution reverted'), 'wrapping');
  const approval = describeTransactionError(new Error('execution reverted'), 'approving-weth');

  assert.equal(wrapping.title, 'ETH wrapping reverted.');
  assert.match(wrapping.explanation, /wrap ETH into WETH/);
  assert.equal(approval.title, 'WETH approval reverted.');
  assert.match(approval.explanation, /WETH approval/);
});

test('gives an actionable fallback while retaining technical details', () => {
  const result = describeTransactionError(new Error('RPC endpoint unavailable'), 'preparing');

  assert.equal(result.title, 'Could not open the position.');
  assert.match(result.explanation, /No transaction was completed/);
  assert.equal(result.technicalDetails, 'RPC endpoint unavailable');
});
