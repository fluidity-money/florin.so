import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const graph = await readFile(new URL('../lib/account-graph.ts', import.meta.url), 'utf8');
const hook = await readFile(new URL('../hooks/useAccount.ts', import.meta.url), 'utf8');
const openPosition = await readFile(new URL('../components/open-position-form.tsx', import.meta.url), 'utf8');
const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

test('account metadata uses Accounts while Florin position creation uses Florin Graph', () => {
  assert.match(graph, /graphRequest<\{ publickey: string \}>\([\s\S]*?ACCOUNTS_GRAPH_URL/);
  assert.match(graph, /graphRequest<\{ hasCreated: boolean \}>\([\s\S]*?ACCOUNTS_GRAPH_URL/);
  assert.match(graph, /graphRequest<\{ requestSecret: string \}>\([\s\S]*?ACCOUNTS_GRAPH_URL/);
  assert.match(graph, /createAccountFlorinOpenPosition:[\s\S]*?>\([\s\S]*?FLORIN_GRAPH_URL/);
});

test('useAccount signs the account payload and exposes the complete account-position mutation', () => {
  assert.match(hook, /New Superposition account:/);
  assert.match(hook, /parseSignature\(signature\)/);
  assert.match(hook, /createAccountFlorinOpenPosition,/);
  assert.match(hook, /checkAndSetSecret/);
  assert.match(hook, /dryrun,/);
});

test('opening a position uses the account mutation only behind enable-accounts', () => {
  assert.match(openPosition, /useFeature\('enable-accounts'\)/);
  assert.match(openPosition, /useAccount\(\)/);
  assert.match(openPosition, /if \(enableAccounts\)/);
  assert.match(openPosition, /createAccountFlorinOpenPosition\(\{/);
  assert.match(openPosition, /asset: 'SPY'/);
  assert.match(openPosition, /collateralAmt: collateralWei\.toString\(\)/);
  assert.match(openPosition, /boldAmt: borrowedWei\.toString\(\)/);
  assert.match(openPosition, /annualInterestRate: rateWei\.toString\(\)/);
  assert.match(openPosition, /ownerIndex: ownerIndex\.toString\(\)/);
  assert.match(openPosition, /maxUpfrontFee: maxUpfrontFee\(predictedFee\)\.toString\(\)/);
  assert.match(openPosition, /receiver: account/);
});

test('account service and authority are documented as public deployment configuration', () => {
  assert.match(env, /^NEXT_PUBLIC_ACCOUNTS_URL=/m);
  assert.match(env, /^NEXT_PUBLIC_ACCOUNT_AUTHORITY_ADDR=/m);
});