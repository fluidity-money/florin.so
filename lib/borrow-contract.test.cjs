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
const WAD = 10n ** 18n;

function permitClient(overrides = {}) {
  const values = {
    eip712Domain: ['0x0f', 'SPDR S&P 500 ETF Trust • Robinhood Token', '1', 46630n, contract.CONTRACTS.spyToken, `0x${'00'.repeat(32)}`, []],
    DOMAIN_SEPARATOR: '0x079d0747f93aa284e177d978690cca62aaf58b7ff1b8ec1c3cd4e7e1713e9f59',
    nonces: 7n, collToken: contract.CONTRACTS.spyToken,
    borrowerOperations: contract.CONTRACTS.borrowerOperations, WETH: contract.CONTRACTS.weth,
    ...overrides,
  };
  return {
    getChainId: async () => 46630,
    getBlock: async () => ({ number: 42n, timestamp: 1000n }),
    readContract: async ({ functionName, blockNumber, args }) => {
      assert.equal(blockNumber, 42n);
      if (functionName === 'nonces') assert.deepEqual(args, [contract.CONTRACTS.troveNft]);
      return values[functionName];
    },
  };
}

test('permit uses verified live domain, owner nonce, exact collateral, zapper spender and bounded deadline', async () => {
  const permit = await contract.prepareCollateralPermit(permitClient(), contract.CONTRACTS.troveNft, WAD);
  assert.deepEqual(permit.message, {
    owner: contract.CONTRACTS.troveNft, spender: contract.CONTRACTS.gasCompZapper,
    value: WAD, nonce: 7n, deadline: 2200n,
  });
  assert.equal(permit.primaryType, 'Permit');
  assert.equal(permit.domain.chainId, 46630n);
  assert.equal(permit.domain.verifyingContract, contract.CONTRACTS.spyToken);
});

test('permit fails closed for wrong chain, domain, separator, deployment and unavailable reads', async () => {
  const owner = contract.CONTRACTS.troveNft;
  for (const field of ['collToken', 'borrowerOperations', 'WETH']) {
    await assert.rejects(contract.prepareCollateralPermit(permitClient({ [field]: owner }), owner, WAD), /deployment/);
  }
  for (const metadata of [
    ['0x1f', 'SPY', '1', 46630n, contract.CONTRACTS.spyToken, '0x00', []],
    ['0x0f', 'SPY', '1', 1n, contract.CONTRACTS.spyToken, '0x00', []],
    ['0x0f', 'SPY', '1', 46630n, owner, '0x00', []],
    ['0x0f', 'SPY', '1', 46630n, contract.CONTRACTS.spyToken, '0x00', [1n]],
  ]) await assert.rejects(contract.prepareCollateralPermit(permitClient({ eip712Domain: metadata }), owner, WAD), /domain/);
  await assert.rejects(contract.prepareCollateralPermit(permitClient({ DOMAIN_SEPARATOR: '0x00' }), owner, WAD), /separator/);
  await assert.rejects(contract.prepareCollateralPermit({ ...permitClient(), getChainId: async () => 1 }, owner, WAD), /network/);
  await assert.rejects(contract.prepareCollateralPermit({ ...permitClient(), readContract: async () => { throw new Error('RPC unavailable'); } }, owner, WAD), /RPC unavailable/);
  await assert.rejects(contract.prepareCollateralPermit(permitClient(), owner, 0n), /collateral/);
});

test('permit signature round trips to the exact payable zapper tuple', async () => {
  const { privateKeyToAccount } = require('viem/accounts');
  const { encodeFunctionData, decodeFunctionData, recoverTypedDataAddress, zeroAddress } = require('viem');
  const signer = privateKeyToAccount(`0x${'01'.repeat(32)}`);
  const typed = await contract.prepareCollateralPermit(permitClient(), contract.CONTRACTS.troveNft, WAD);
  typed.message.owner = signer.address;
  const signature = await signer.signTypedData(typed);
  assert.equal(await recoverTypedDataAddress({ ...typed, signature }), signer.address);
  const permit = contract.collateralPermitParams(WAD, typed.message.deadline, signature);
  assert.ok([27, 28].includes(permit.v));
  assert.equal(permit.r.length, 66);
  const params = { owner: signer.address, ownerIndex: 9n, collAmount: WAD, boldAmount: 1000n * WAD,
    upperHint: 1n, lowerHint: 2n, annualInterestRate: WAD / 20n, batchManager: zeroAddress,
    maxUpfrontFee: 7n, addManager: zeroAddress, removeManager: zeroAddress, receiver: zeroAddress };
  const abi = contract.gasCompZapperAbi;
  const data = encodeFunctionData({ abi, functionName: 'openTroveWithRawETHPermit', args: [permit, params] });
  assert.deepEqual(decodeFunctionData({ abi, data }).args, [permit, params]);
  assert.equal(abi[0].stateMutability, 'payable');
  assert.deepEqual(abi[0].inputs[0].components.map(x => x.name), ['value', 'deadline', 'v', 'r', 's']);
  assert.deepEqual(abi[0].inputs[1].components.map(x => x.name), Object.keys(params));
  assert.throws(() => contract.collateralPermitParams(WAD, 2200n, '0x1234'));
});

test('direct opening signs once, refreshes after signature and submits only the payable zapper call', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/open-position-form.tsx'), 'utf8');
  const direct = source.slice(source.indexOf("if (directState === null)"), source.indexOf('  if (minted && txHash)'));
  assert.equal((direct.match(/walletClient.writeContract/g) || []).length, 1);
  assert.equal((direct.match(/walletClient.signTypedData/g) || []).length, 1);
  assert.doesNotMatch(direct, /functionName: '(approve|deposit|openTrove)'/);
  assert.match(direct, /address: CONTRACTS.gasCompZapper/);
  assert.match(direct, /value: LIQUIDATOR_COMPENSATION_WETH/);
  assert.match(direct, /addManager: zeroAddress, removeManager: zeroAddress, receiver: zeroAddress/);
  const signed = direct.indexOf('await walletClient.signTypedData');
  assert(direct.indexOf('await requireAuthorizedAccount') < signed);
  assert(direct.indexOf('await requireAuthorizedAccount', signed) > signed);
  assert(direct.indexOf('await refreshOpening()', signed) < direct.indexOf('await publicClient.simulateContract'));
  assert.match(direct, /if \(replacementInvalid\) throw/);
  assert.match(direct, /pendingPositions.confirm/);
  assert.match(direct, /positionsFromReceipt/);
  assert(source.indexOf('createAccountFlorinOpenPosition({') < source.indexOf('prepareCollateralPermit(publicClient'));
});

// Execute the actual direct-path body with mocked wallet/RPC boundaries. This is
// a focused flow test, not browser-wallet or deployed opening integration coverage.
async function runDirectOpening({ rejectSignature = false, nativeBalance = contract.LIQUIDATOR_COMPENSATION_WETH, staleQuote = false, receiptStatus = 'success', replacement } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../components/open-position-form.tsx'), 'utf8');
  const body = source.slice(source.indexOf('      if (directState === null)'), source.indexOf('    } catch (cause) {\n      reportError(cause, failureStage, transactionHash);'));
  const calls = [];
  const { zeroAddress, formatUnits } = require('viem');
  const account = contract.CONTRACTS.troveNft;
  const typed = await contract.prepareCollateralPermit(permitClient(), account, WAD);
  const signature = `0x${'11'.repeat(32)}${'22'.repeat(32)}1b`;
  const walletClient = {
    signTypedData: async data => { calls.push('sign'); assert.deepEqual(data, typed); if (rejectSignature) throw new Error('User rejected signature'); return signature; },
    writeContract: async request => { calls.push('write'); assert.equal(request.functionName, 'openTroveWithRawETHPermit'); assert.equal(request.gas, 1_040_000n); return '0xhash'; },
  };
  const env = {
    ...contract, directState: nativeBalance, account, zeroAddress, formatUnits,
    wallet: { provider: {}, kind: 'test' }, robinhoodTestnet: {}, custom: x => x,
    createWalletClient: () => walletClient,
    prepareCollateralPermit: async () => typed,
    requireAuthorizedAccount: async () => { calls.push('authorize'); },
    collateralWei: WAD, borrowedWei: 1000n * WAD, rateWei: WAD / 20n, troveCount: 0n,
    refreshOpening: async () => { calls.push('refresh'); if (staleQuote) throw new Error('Review updated quote'); return 7n; },
    publicClient: {
      simulateContract: async request => {
        calls.push('simulate');
        assert.equal(request.address, contract.CONTRACTS.gasCompZapper);
        assert.equal(request.value, contract.LIQUIDATOR_COMPENSATION_WETH);
        assert.deepEqual(request.args[0], contract.collateralPermitParams(WAD, typed.message.deadline, signature));
        assert.equal(request.args[1].owner, account);
        assert.equal(request.args[1].maxUpfrontFee, 7n);
        for (const key of ['batchManager', 'addManager', 'removeManager', 'receiver']) assert.equal(request.args[1][key], zeroAddress);
        return { request };
      },
      // The open is sent with a 30% gas margin over this estimate.
      estimateContractGas: async request => {
        assert.equal(request.functionName, 'openTroveWithRawETHPermit');
        return 800_000n;
      },
      waitForTransactionReceipt: async ({ onReplaced }) => {
        calls.push('receipt');
        if (replacement) onReplaced({ reason: replacement, transaction: { hash: '0xreplacement' } });
        return { status: receiptStatus };
      },
    },
    randomOwnerIndex: () => 9n, setStage: () => {}, setTxHash: () => {},
    prepareMarketAction: () => () => { calls.push('markets'); },
    pendingPositions: { confirm: () => { calls.push('confirmed'); } },
    positionsFromReceipt: () => [], setOpenedPosition: () => {},
    chainState: { refetch: async () => {} }, captureEvent: () => {}, redemptionRisk: 'low',
    setMinted: () => { calls.push('minted'); },
  };
  const execute = new Function(...Object.keys(env), `return (async () => { let failureStage; let transactionHash; ${body} })();`);
  try { await execute(...Object.values(env)); return { calls }; }
  catch (error) { return { calls, error }; }
}

test('direct wallet runtime signs then reviews, simulates, submits and confirms exactly once', async () => {
  const { calls, error } = await runDirectOpening();
  assert.equal(error, undefined);
  assert.deepEqual(calls, ['authorize', 'sign', 'authorize', 'refresh', 'simulate', 'write', 'receipt', 'confirmed', 'markets', 'minted']);
});

test('direct wallet runtime never submits after signature rejection, low native balance or stale quote', async () => {
  for (const options of [{ rejectSignature: true }, { nativeBalance: 0n }, { staleQuote: true }]) {
    const { calls, error } = await runDirectOpening(options);
    assert.ok(error);
    assert(!calls.includes('write'));
    assert(!calls.includes('minted'));
  }
});

test('direct wallet runtime rejects reverted/cancelled receipts and accepts repricing', async () => {
  for (const options of [{ receiptStatus: 'reverted' }, { replacement: 'cancelled' }, { replacement: 'replaced' }]) {
    const { calls, error } = await runDirectOpening(options);
    assert.ok(error);
    assert(!calls.includes('confirmed'));
    assert(!calls.includes('minted'));
  }
  const repriced = await runDirectOpening({ replacement: 'repriced' });
  assert.equal(repriced.error, undefined);
  assert(repriced.calls.includes('minted'));
});

test('permit cancellation is explicit and does not imply an approval transaction', () => {
  const { describeTransactionError } = loadTypeScriptModule('transaction-error.ts');
  const error = describeTransactionError({ code: 4001, message: 'User rejected request' }, 'signing-permit');
  assert.equal(error.title, 'Permit signature cancelled.');
  assert.match(error.explanation, /No transaction was submitted/);
  assert.equal(error.stage, 'signing-permit');
});

test('withdrawal Max rounds required collateral up, clamps zero, and never crosses 110%', () => {
  assert.equal(contract.maxWithdrawableCollateral(2n * WAD, WAD, WAD), 9n * WAD / 10n);
  assert.equal(contract.maxWithdrawableCollateral(10n, 1n, WAD), 8n);
  assert.equal(contract.maxWithdrawableCollateral(1n, 1n, WAD), 0n);
  assert.equal(contract.maxWithdrawableCollateral(10n, 0n, WAD), 10n);
  assert.throws(() => contract.maxWithdrawableCollateral(WAD, WAD, 0n), /Invalid/);
  for (const price of [1n, WAD, 3n * WAD, 772272n * WAD / 10000n]) {
    const debt = 17n * WAD + 1n;
    const collateral = 100n * WAD;
    const max = contract.maxWithdrawableCollateral(collateral, debt, price);
    if (max > 0n) {
      assert.ok((collateral - max) * price * 10n >= debt * 11n * WAD);
      assert.ok((collateral - max - 1n) * price * 10n < debt * 11n * WAD);
    }
  }
});

test('live accrued debt reduces withdrawal and borrowing capacity and preserves minimum repayment debt', () => {
  const before = contract.MIN_DEBT + 20n * WAD;
  const after = before + WAD;
  assert.ok(contract.maxWithdrawableCollateral(100n * WAD, after, 100n * WAD)
    < contract.maxWithdrawableCollateral(100n * WAD, before, 100n * WAD));
  assert.ok(contract.maxBorrowPrincipal(9_000n * WAD, after, 0n)
    < contract.maxBorrowPrincipal(9_000n * WAD, before, 0n));
  assert.equal(after - contract.maxRepayableDebt(after), contract.MIN_DEBT);
  assert.equal(contract.maxRepayableDebt(contract.MIN_DEBT - 1n), 0n);
});

test('failed refetch cannot authorize using retained cached data', () => {
  const stale = { entireDebt: WAD };
  assert.throws(() => contract.requireFreshRead({ data: stale, isError: true, error: new Error('RPC failed') }), /RPC failed/);
  assert.throws(() => contract.requireFreshRead({ isError: false }), /unavailable/);
  assert.equal(contract.requireFreshRead({ data: stale, isError: false }), stale);
});

test('live reads validate deployment before RPC and propagate either read failure', async () => {
  let calls = 0;
  const manager = contract.CONTRACTS.troveManager;
  const latest = { entireDebt: 21n * WAD, entireColl: WAD, annualInterestRate: WAD / 20n };
  const client = { async readContract({ functionName, address }) {
    calls++;
    assert.equal(address, manager);
    return functionName === 'getLatestTroveData' ? latest : [0n, 0n, 0n, 1, 0n, 0n, 0n, 0n, manager, 0n];
  } };
  await assert.rejects(contract.readLivePosition(client, '0xwrong', 1n), /unsupported/);
  assert.equal(calls, 0);
  assert.deepEqual(await contract.readLivePosition(client, manager.toUpperCase(), 1n), { ...latest, interestBatchManager: manager });
  for (const failing of ['Troves', 'getLatestTroveData']) {
    await assert.rejects(contract.readLivePosition({ async readContract(request) {
      if (request.functionName === failing) throw new Error('RPC failed');
      return client.readContract(request);
    } }, manager, 1n), /RPC failed/);
  }
});

test('live position ABI keeps the exact debt, collateral and rate tuple order', () => {
  const latest = contract.troveManagerAbi.find(item => item.name === 'getLatestTroveData');
  assert.deepEqual(latest.outputs[0].components.map(field => field.name), [
    'entireDebt', 'entireColl', 'redistBoldDebtGain', 'redistCollGain',
    'accruedInterest', 'recordedDebt', 'annualInterestRate', 'weightedRecordedDebt',
    'accruedBatchManagementFee', 'lastInterestRateAdjTime',
  ]);
  const troves = contract.troveManagerAbi.find(item => item.name === 'Troves');
  assert.equal(troves.outputs[3].type, 'uint8');
  assert.equal(troves.outputs[8].name, 'interestBatchManager');
});

test('live reads reject closed positions even when the indexer still lists them', async () => {
  await assert.rejects(contract.readLivePosition({ async readContract({ functionName }) {
    return functionName === 'Troves' ? [0n, 0n, 0n, 2] : { entireDebt: 0n, entireColl: 0n };
  } }, contract.CONTRACTS.troveManager, 1n), /no longer open/);
});

test('rate preview uses fee-inclusive live debt, independent of collateral/debt edits', () => {
  const preview = contract.rateChangePreview(WAD, 20n * WAD, 100n * WAD, WAD / 10n, WAD);
  assert.equal(preview.resultingDebt, 21n * WAD);
  assert.equal(preview.annualInterest, 21n * WAD / 10n);
  assert.equal(preview.monthlyInterest, preview.annualInterest / 12n);
  assert.equal(preview.safe, true);
  assert.equal(contract.rateChangePreview(22n * WAD, 20n * WAD, WAD, WAD / 10n, 0n).safe, true);
  assert.equal(contract.rateChangePreview(22n * WAD, 20n * WAD, WAD, WAD / 10n, 1n).safe, false);
});

test('management wiring refreshes live reads and fee before signing and after confirmation', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/manage-position.tsx'), 'utf8');
  assert.match(source, /queryFn: \(\) => readLivePosition/);
  assert.match(source, /const latest = requireFreshRead\(await livePosition\.refetch\(\)\)/);
  assert.match(source, /livePosition\.refetch\(\), rateFee\.refetch\(\), chainState\.refetch\(\)/);
  assert.match(source, /setTxComplete\(true\);\s*await Promise\.all\(\[livePosition\.refetch/);
  // Collateral and debt are sent together, checked from fresh reads against the 110% floor.
  assert.match(source, /functionName: 'adjustTrove'/);
  assert.match(source, /collAfter \* state\.price \* 10n < debtAfter \* 11n \* 10n \*\* 18n/);
  assert.match(source, /rateChangePreview\(currentCollateralWei, currentDebtWei, chainState\.data\.price, rateWei, rateFee\.data\)/);
  assert.doesNotMatch(source, /BigInt\(position\.(debt|collateral)\)/);
});

test('batches the 199-trial search, carries seeds and retains the closest hint', async () => {
  const calls = [];
  const diffs = [90n, 20n, 5n, 40n, 60n];
  const client = {
    async readContract(request) {
      calls.push(request);
      assert.equal(request.functionName, 'getApproxHint');
      assert.equal(request.address, contract.CONTRACTS.hintHelpers);
      assert.ok(request.args[2] <= 50n, 'each call stays below the RPC gas allowance');
      const i = calls.length - 1;
      return [BigInt(i + 10), diffs[i], BigInt(i + 101)];
    },
  };
  const hint = await contract.getApproxHintBatched(client, 60_000_000_000_000_000n, 175n, 100n);
  assert.equal(hint, 12n);
  assert.deepEqual(calls.map(c => c.args[2]), [50n, 50n, 50n, 50n, 3n]);
  assert.deepEqual(calls.map(c => c.args[3]), [100n, 101n, 102n, 103n, 104n]);
  assert.ok(calls.every(c => c.args[0] === 0n && c.args[1] === 60_000_000_000_000_000n));
  // Each contract call initializes from the tail and performs numTrials - 1 random samples.
  assert.equal(calls.reduce((n, c) => n + c.args[2] - 1n, 0n), contract.hintTrials(175n) - 1n);
});

test('empty hint search makes no RPC calls', async () => {
  const client = { readContract() { assert.fail('unexpected RPC call'); } };
  assert.equal(await contract.getApproxHintBatched(client, 1n, 0n, 100n), 0n);
});

test('small hint search uses one call', async () => {
  let calls = 0;
  const client = { async readContract({ args }) {
    calls++;
    assert.deepEqual(args, [0n, 1n, 15n, 100n]);
    return [42n, 1n, 101n];
  } };
  assert.equal(await contract.getApproxHintBatched(client, 1n, 1n, 100n), 42n);
  assert.equal(calls, 1);
});

test('hint search propagates RPC failures instead of using an incomplete result', async () => {
  let calls = 0;
  const error = new Error('RPC unavailable');
  const client = { async readContract() {
    if (++calls === 2) throw error;
    return [42n, 1n, 101n];
  } };
  await assert.rejects(contract.getApproxHintBatched(client, 1n, 175n, 100n), error);
});

test('uses the addresses/46630.json Robinhood testnet SPY deployment', () => {
  assert.deepEqual(contract.CONTRACTS, {
    gasCompZapper: '0x90910002956b3C881B74910F5f144b6a73dCcFbe',
    spyToken: '0x8823b40A23387Df76E127744FFB38b26eB012A5c',
    metadataNft: '0xd2e22b2a1ec0b287cb550e92255694aaa0b6e133',
    base: '0xd48655f1fc1a6648246cc9802c6ee5190c93fec0',
    boldToken: '0x1f93de989cd9d30b2c31f3227769632729858196',
    collateralRegistry: '0xeb264317b915cb1a8c8e3ca27dd270d947bba968',
    hintHelpers: '0xcd8bf0cb142d8e612b9685772b2c5439240c1ba5',
    multiTroveGetter: '0x8fac04bbcaadced3074a2909d9490510033b4caa',
    activePool: '0xf00a7eb2cf0d8dee71788bbb99d57d8a4ef98775',
    borrowerOperations: '0xfea06161dbd14374ee6a746eae3502a1a6741990',
    collSurplusPool: '0x43a5c00937b4aec0b56f0e12dedd2247e4a454f7',
    defaultPool: '0x47697a6400bd3848519f469bbc0824b954826e66',
    gasPool: '0xdc6041cc3ba941e96421ed13e26b2f4ffefb7b71',
    sortedTroves: '0x83311690476dfa9239b55e732b4b6638a15142df',
    stabilityPool: '0x9543b191c66c4fa68b9b7888df65b661842ace1b',
    troveManager: '0xc1ebb33678176d7fb5c8fef3ba5a610d50bacc63',
    troveNft: '0xe361393f4d0f3b40eca34c7a83e27e4b5dcfa1c3',
    spyPriceFeed: '0xb7dc3a2596e9a0571b6e104d2f1a3d35b0653862',
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
  assert.equal(contract.maxRepayableDebt(1_030n * 10n ** 18n), 30n * 10n ** 18n);
  assert.equal(contract.maxRepayableDebt(1_000n * 10n ** 18n), 0n);
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

test('enforces a 1,000 FUSD minimum loan', () => {
  const minimum = 1_000n * WAD;
  const rate = 5n * 10n ** 15n;
  assert.equal(contract.MIN_DEBT, minimum);
  assert.equal(contract.validateOpenTrove(0n, minimum, rate), 'Enter SPY collateral.');
  assert.equal(contract.validateOpenTrove(WAD, minimum - 1n, rate), 'Borrow at least 1,000 FUSD.');
  assert.equal(contract.validateOpenTrove(WAD, minimum, 4n * 10n ** 15n), 'Choose an interest rate of at least 0.5%.');
  assert.equal(contract.validateOpenTrove(WAD, minimum, rate), null);
  assert.equal(contract.validateOpenTrove(WAD, minimum + 1n, rate), null);
});
