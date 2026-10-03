import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function text(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

test('the site has no password gate', () => {
  assert.equal(existsSync(new URL('middleware.ts', root)), false);
  assert.equal(existsSync(new URL('app/api/gate/route.ts', root)), false);
  assert.equal(existsSync(new URL('lib/beta-gate.ts', root)), false);
  assert.equal(existsSync(new URL('lib/beta-gate-page.ts', root)), false);
  assert.doesNotMatch(text('.env.example'), /BETA_PASSWORD/);
  assert.doesNotMatch(text('README.md'), /password|beta gate/i);
});

test('the homepage shows hardcoded testnet activity below the borrowing risks', () => {
  const homepage = text('app/page.tsx');
  const risks = homepage.indexOf('<RisksDialog');
  const stats = homepage.indexOf('className="testnet-stats"');

  assert.ok(risks >= 0);
  assert.ok(stats > risks);
  assert.match(homepage, /Testnet Stats/);
  assert.match(homepage, /\{ label: 'Faucet users', value: 500 \}/);
  assert.match(homepage, /\{ label: 'Unique wallets', value: 800 \}/);
});
