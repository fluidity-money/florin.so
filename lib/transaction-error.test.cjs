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
const { requireAuthorizedAccount } = loadTypeScriptModule('wallet-authorization.ts');

const account = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

const periods = require('../public/market-pause-periods.json');
const { getMarketPauseReason, getMarketClosedExplanation } = loadTypeScriptModule('transaction-error.ts');

test('portable calendar is sorted, valid, non-overlapping and uses exclusive ends', () => {
	let previousEnd = -Infinity;
	for (const period of periods) {
		assert.deepEqual(Object.keys(period), ['start', 'end', 'reason']);
		const start = Date.parse(period.start);
		const end = Date.parse(period.end);
		assert.ok(start >= previousEnd && end > start);
		assert.ok(period.reason.trim());
		assert.match(period.start, /[+-]\d{2}:\d{2}$/);
		assert.equal(getMarketPauseReason(start), period.reason);
		assert.equal(getMarketPauseReason(end - 1), period.reason);
		assert.equal(getMarketPauseReason(end), periods.find(p => Date.parse(p.start) === end)?.reason);
		previousEnd = end;
	}
});

test('holidays, early closes, weekends and DST offsets explain the pause', () => {
	assert.match(getMarketPauseReason(Date.parse('2026-11-26T12:00:00-05:00')), /Thanksgiving/);
	assert.equal(getMarketPauseReason(Date.parse('2026-11-27T12:59:59-05:00')), undefined);
	assert.match(getMarketPauseReason(Date.parse('2026-11-27T13:00:00-05:00')), /Early market close/);
	assert.match(getMarketPauseReason(Date.parse('2027-06-18T12:00:00-04:00')), /Juneteenth/);
	assert.match(getMarketPauseReason(Date.parse('2027-03-14T23:59:59Z')), /weekend/);
	assert.equal(getMarketPauseReason(Date.parse('2027-03-15T00:00:00Z')), undefined);
	assert.match(getMarketPauseReason(Date.parse('2027-11-08T00:59:59Z')), /weekend/);
	assert.equal(getMarketPauseReason(Date.parse('2027-11-08T01:00:00Z')), undefined);
});

test('unknown pauses do not invent a reason or reopening time', () => {
	for (const now of [Date.parse('2028-07-04T15:00:00Z'), Date.parse('2026-11-24T15:00:00Z'), NaN]) {
		assert.equal(getMarketPauseReason(now), undefined);
		assert.match(getMarketClosedExplanation(now), /^Opening positions/);
		assert.doesNotMatch(getMarketClosedExplanation(now), /holiday|weekend|9:30/);
	}
});

test('transaction error includes the current calendar reason', () => {
	const originalNow = Date.now;
	try {
		Date.now = () => Date.parse('2026-11-26T12:00:00-05:00');
		assert.match(describeTransactionError({ reason: 'StockPaused' }, 'opening').explanation, /Thanksgiving/);
	} finally {
		Date.now = originalNow;
	}
});

test('preflight accepts the displayed authorized account case-insensitively without prompting', async () => {
  const calls = [];
  await requireAuthorizedAccount({ request: async (request) => {
    calls.push(request);
    return ['0x1111111111111111111111111111111111111111', account.toUpperCase()];
  } }, account);
  assert.deepEqual(calls, [{ method: 'eth_accounts' }]);
});

test('preflight rejects missing, different, and malformed account lists without choosing another account', async () => {
  for (const accounts of [[], ['0x1111111111111111111111111111111111111111'], null, [null]]) {
    await assert.rejects(requireAuthorizedAccount({ request: async () => accounts }, account), { code: 4100 });
  }
});

test('preflight preserves provider failures', async () => {
  const error = Object.assign(new Error('Provider unavailable'), { code: 4900 });
  await assert.rejects(requireAuthorizedAccount({ request: async () => { throw error; } }, account),
    (caught) => caught === error);
});

test('authorization errors give reconnect guidance, including wrapped numeric and string codes', () => {
  for (const error of [
    { code: 4100 },
    { code: -32603, cause: { code: '4100' } },
    { data: { code: 4100 } },
    new Error('The requested method and/or account has not been authorized by the user.'),
  ]) {
    const result = describeTransactionError(error, 'switching');
    assert.equal(result.title, 'Reconnect your wallet.');
    assert.match(result.explanation, /account displayed in Florin/);
    assert.equal(result.code, '4100');
  }
});

test('open-position preflight brackets network switching before preparation', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/open-position-form.tsx'), 'utf8');
  assert.match(source, /const owner = account;/);
  assert.match(source, /const provider = wallet.provider;/);
  assert.match(source, /await requireAuthorizedAccount\(provider, owner\);\s*await ensureRobinhoodTestnet\(provider\);\s*await requireAuthorizedAccount\(provider, owner\);\s*failureStage = 'preparing'/);
});

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
  assert.match(result.explanation, /0\.001 ETH for liquidator compensation/i);
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

test('revert descriptions preserve action-specific titles and unknown reasons for every stage', () => {
	const stages = ['connecting', 'switching', 'preparing', 'signing-permit', 'wrapping', 'approving-weth', 'approving', 'opening', 'confirming'];
	const actions = {
		wrapping: ['ETH wrapping reverted.', 'wrap ETH into WETH'],
		'approving-weth': ['WETH approval reverted.', 'WETH approval'],
		approving: ['SPY approval reverted.', 'SPY approval'],
	};
	for (const stage of stages) {
		const [title, action] = actions[stage] ?? ['Open position reverted.', 'position'];
		for (const reason of [undefined, 'UnknownReason']) {
			const result = describeTransactionError({ message: 'execution reverted', reason, code: -1 }, stage);
			assert.equal(result.title, title);
			assert.equal(result.explanation, reason
				? `The contract rejected the ${action}. Contract reason: UnknownReason. No position was opened.`
				: `The contract rejected the ${action}. No position was opened. Check the technical details below and try again.`);
			assert.equal(result.stage, stage);
			assert.equal(result.code, '-1');
		}
	}
});

test('gives an actionable fallback while retaining technical details', () => {
  const result = describeTransactionError(new Error('RPC endpoint unavailable'), 'preparing');

  assert.equal(result.title, 'Could not open the position.');
  assert.match(result.explanation, /No transaction was completed/);
  assert.equal(result.technicalDetails, 'RPC endpoint unavailable');
});

test('market-closed reverts read as a plain market-hours message, by name or bare selector', () => {
  const errors = loadTypeScriptModule('transaction-error.ts');
  // As reported: viem could not decode BorrowerOperations' StockPaused().
  const bareSelector = { shortMessage: 'The contract function "openTroveWithRawETHPermit" reverted with the following signature: 0x1a21f1f2' };
  const named = { shortMessage: 'execution reverted', reason: 'StockMarketPaused' };
  for (const error of [bareSelector, named]) {
    assert.equal(errors.isMarketClosedError(error), true);
    const described = errors.describeTransactionError(error, 'opening');
    assert.equal(described.title, 'Market is paused.');
		assert.match(described.explanation, /on-chain market pause is lifted/);
		assert.doesNotMatch(described.explanation, /9:30/);
  }
  const other = { shortMessage: 'execution reverted', reason: 'ICRBelowMCR' };
  assert.equal(errors.isMarketClosedError(other), false);
  assert.equal(errors.describeTransactionError(other, 'opening').title, 'Open position reverted.');
});
