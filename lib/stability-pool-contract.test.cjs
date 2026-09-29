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

function fn(name) {
  return contract.stabilityPoolAbi.find((item) => item.type === 'function' && item.name === name);
}

test('stability pool ABI matches the deployed Liquity interface', () => {
  assert.deepEqual(fn('provideToSP').inputs.map((input) => input.type), ['uint256', 'bool']);
  assert.deepEqual(fn('withdrawFromSP').inputs.map((input) => input.type), ['uint256', 'bool']);
  assert.deepEqual(fn('claimAllCollGains').inputs, []);
  assert.deepEqual(fn('getTotalBoldDeposits').outputs.map((output) => output.type), ['uint256']);
  assert.deepEqual(fn('getCompoundedBoldDeposit').inputs.map((input) => input.type), ['address']);
  assert.deepEqual(fn('getDepositorCollGain').inputs.map((input) => input.type), ['address']);
  assert.deepEqual(fn('getDepositorYieldGainWithPending').inputs.map((input) => input.type), ['address']);
  assert.deepEqual(fn('stashedColl').inputs.map((input) => input.type), ['address']);
});

test('stability pool amount validation rejects zero and excess amounts', () => {
  assert.equal(contract.validateStabilityPoolAmount('deposit', 0n, 10n), 'Enter an amount to deposit.');
  assert.equal(contract.validateStabilityPoolAmount('deposit', 11n, 10n), 'You do not have enough FUSD.');
  assert.equal(contract.validateStabilityPoolAmount('withdraw', 0n, 10n), 'Enter an amount to withdraw.');
  assert.equal(contract.validateStabilityPoolAmount('withdraw', 11n, 10n), 'You do not have that much FUSD deposited.');
  assert.equal(contract.validateStabilityPoolAmount('deposit', 10n, 10n), null);
  assert.equal(contract.validateStabilityPoolAmount('withdraw', 10n, 10n), null);
});
