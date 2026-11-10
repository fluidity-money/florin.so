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

test('testnet defaults, explicit zero disables, and legacy exchange override precedence', () => {
  const keys = ['NEXT_PUBLIC_LEVERAGE_ZAPPER_ADDRESS', 'NEXT_PUBLIC_MULTIPLY_EXCHANGE_ADDRESS', 'NEXT_PUBLIC_MULTIPLY_QUOTER_ADDRESS', 'NEXT_PUBLIC_GAS_COMP_ZAPPER_ADDRESS'];
  const saved = keys.map(key => process.env[key]);
  const zero = '0x0000000000000000000000000000000000000000';
  const override = '0x1111111111111111111111111111111111111111';
  try {
    for (const key of keys) delete process.env[key];
    const defaults = loadTypeScriptModule('multiply-contract.ts').CONTRACTS;
    assert.deepEqual(defaults, {
      leverageZapper: '0xf63a41A0C8fDB81704C92Ba39eAcfB11f8C3FD87',
      exchange: '0x6AfC499c52571F03272Fa6a4FBba0b73674f7f4c',
      gasCompZapper: '0x2Ce45DC74397aE3A5082cc822A9A978fd387429b',
    });
    for (const key of keys) process.env[key] = '';
    assert.deepEqual(loadTypeScriptModule('multiply-contract.ts').CONTRACTS, defaults);
    process.env.NEXT_PUBLIC_MULTIPLY_QUOTER_ADDRESS = override;
    assert.equal(loadTypeScriptModule('multiply-contract.ts').CONTRACTS.exchange, override);
    process.env.NEXT_PUBLIC_MULTIPLY_EXCHANGE_ADDRESS = zero;
    process.env.NEXT_PUBLIC_LEVERAGE_ZAPPER_ADDRESS = zero;
    assert.equal(loadTypeScriptModule('multiply-contract.ts').CONTRACTS.exchange, zero);
    assert.equal(loadTypeScriptModule('multiply-contract.ts').CONTRACTS.leverageZapper, zero);
  } finally {
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
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

test('the minimum exact-input debt receives a 0.5% ceiling', () => {
  assert.equal(multiply.addMultiplySlippage(6_000n * WAD), 6_030n * WAD);
  assert.equal(multiply.addMultiplySlippage(1n), 2n);
});

test('leverage zapper ABI preserves the canonical tuple order', () => {
  const open = multiply.leverageZapperAbi.find((item) => item.name === 'openLeveragedTroveWithSPY');
  assert.equal(open.stateMutability, 'payable');
  assert.deepEqual(open.inputs[0].components.map((item) => item.name), [
    'owner', 'ownerIndex', 'collAmount', 'flashLoanAmount', 'boldAmount',
    'upperHint', 'lowerHint', 'annualInterestRate', 'batchManager',
    'maxUpfrontFee', 'addManager', 'removeManager', 'receiver',
  ]);
});

const address = n => `0x${String(n).padStart(40, '0')}`;
const branch = { spyToken: address(1), boldToken: address(2), borrowerOperations: address(3) };
const exchange = address(4);
const zapper = address(5);
function fixture(overrides = {}) {
  const values = {
    collToken: branch.spyToken, boldToken: branch.boldToken, priceFeed: address(6),
    priceScale: 1n, oracleScale: 100_000_000n,
    latestRoundData: [1n, 600n * 100_000_000n, 0n, 900n, 1n],
    spyBalance: 1_000n * WAD, boldBalance: 0n,
    exchange, flashLoanProvider: exchange, borrowerOperations: branch.borrowerOperations,
    ...overrides,
  };
  const calls = [];
  const client = {
    getBlock: async () => ({ number: 12n, timestamp: 1000n }),
    getCode: async () => '0x1234',
    readContract: async args => {
      calls.push(args);
      return args.functionName === 'balanceOf'
        ? (args.address === branch.spyToken ? values.spyBalance : values.boldBalance)
        : values[args.functionName];
    },
  };
  return { client, calls };
}

test('live quote uses pinned feed/scales/balances and funds loan PLUS padded exact-input output', async () => {
  const { client, calls } = fixture();
  const q = await multiply.quoteMultiply(client, exchange, branch, 10n * WAD);
  assert.equal(q.quotedInput, 6_000n * WAD);
  assert.equal(q.boldAmount, 6_030n * WAD);
  assert.equal(q.swapOutput, 10_050_000_000_000_000_000n);
  assert.equal(q.boldBalance, 0n); // FUSD reserve is not needed in this direction.
  assert(calls.every(call => call.blockNumber === 12n));
  assert.equal(calls.find(call => call.functionName === 'latestRoundData').address, address(6));
  const required = 10n * WAD + q.swapOutput;
  await multiply.quoteMultiply(fixture({ spyBalance: required }).client, exchange, branch, 10n * WAD);
  await assert.rejects(multiply.quoteMultiply(fixture({ spyBalance: required - 1n }).client, exchange, branch, 10n * WAD), /liquidity/);
});

test('inverse rounds upward before slippage, supports non-default scales', async () => {
  const { client } = fixture({ priceScale: 10n ** 12n, oracleScale: 10n ** 18n, latestRoundData: [1n, 123456789n, 0n, 1n, 1n] });
  const q = await multiply.quoteMultiply(client, exchange, branch, 1n);
  assert.equal(q.quotedInput, 124n);
  assert.equal(q.boldAmount, 125n);
  assert(q.swapOutput >= 1n);
});

test('mock oracle matches contract validation: no age limit, but invalid answer/timestamps fail', async () => {
  for (const [answer, timestamp] of [[0n, 900n], [-1n, 900n], [1n, 0n], [1n, 1001n]]) {
    await assert.rejects(multiply.quoteMultiply(fixture({ latestRoundData: [1n, answer, 0n, timestamp, 1n] }).client, exchange, branch, WAD), /oracle/);
  }
  await multiply.quoteMultiply(fixture({ latestRoundData: [1n, 60000000000n, 0n, 1n, 0n] }).client, exchange, branch, WAD);
});

test('quote fails closed on token mismatches, scales, overflow and failed reads', async () => {
  for (const overrides of [{ collToken: address(7) }, { boldToken: address(7) }, { priceScale: 0n }, { oracleScale: 0n }]) {
    await assert.rejects(multiply.quoteMultiply(fixture(overrides).client, exchange, branch, WAD), /mismatch/);
  }
  await assert.rejects(multiply.quoteMultiply(fixture({ priceScale: 2n ** 255n }).client, exchange, branch, WAD), /overflow/);
  const { client } = fixture();
  client.readContract = async () => { throw new Error('RPC failed'); };
  await assert.rejects(multiply.quoteMultiply(client, exchange, branch, WAD), /RPC failed/);
});

test('deployment verification rejects every mismatched spender dependency and missing bytecode', async () => {
  await multiply.verifyMultiplyDeployment(fixture().client, zapper, exchange, branch);
  for (const name of ['collToken', 'boldToken', 'exchange', 'flashLoanProvider', 'borrowerOperations']) {
    await assert.rejects(multiply.verifyMultiplyDeployment(fixture({ [name]: address(9) }).client, zapper, exchange, branch), /could not be verified/);
  }
  const { client } = fixture();
  client.getCode = async () => '0x';
  await assert.rejects(multiply.verifyMultiplyDeployment(client, zapper, exchange, branch), /could not be verified/);
});

test('bigint collateral guard includes the fee ceiling and exact boundary', () => {
  assert.equal(multiply.isMultiplyCollateralSafe(11n * WAD, 100n * WAD, 1000n * WAD, 0n), true);
  assert.equal(multiply.isMultiplyCollateralSafe(11n * WAD, 100n * WAD, 1000n * WAD, 1n), false);
  assert.equal(multiply.isMultiplyCollateralSafe(11n * WAD, 0n, 1000n * WAD, 0n), false);
});
