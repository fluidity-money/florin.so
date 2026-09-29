import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const stability = readFileSync(new URL('../components/stability-pool.tsx', import.meta.url), 'utf8');

test('stability page reads the connected wallet position and rewards', () => {
  assert.match(stability, /getCompoundedBoldDeposit/);
  assert.match(stability, /getDepositorCollGain/);
  assert.match(stability, /getDepositorYieldGainWithPending/);
  assert.match(stability, /stashedColl/);
  assert.match(stability, /functionName: 'getTotalBoldDeposits'/);
  assert.match(stability, /functionName: 'deposits'/);
  assert.match(stability, /Your pool position/);
});

test('stability page can deposit and withdraw FUSD', () => {
  assert.match(stability, /functionName: 'provideToSP'/);
  assert.match(stability, /functionName: 'withdrawFromSP'/);
  assert.match(stability, /functionName: 'approve'/);
  assert.match(stability, /CONTRACTS\.stabilityPool/);
  assert.match(stability, /Deposit FUSD/);
  assert.match(stability, /Withdraw FUSD/);
});

test('stability page can claim FUSD and SPY rewards', () => {
  assert.match(stability, /functionName: 'claimAllCollGains'/);
  assert.match(stability, /Claim rewards/);
  assert.match(stability, /withdrawFromSP/);
});

test('stability transactions expose progress, errors, and explorer links', () => {
  assert.match(stability, /Waiting for confirmation/);
  assert.match(stability, /role="alert"/);
  assert.match(stability, /blockExplorers\.default\.url/);
  assert.match(stability, /setAmountStr\(formatUnits\(maxAmount, 18\)\)/);
  assert.doesNotMatch(stability, /replaceAll\(','/);
  assert.doesNotMatch(stability, /transactions coming soon/i);
});
