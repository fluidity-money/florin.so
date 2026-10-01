import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('ZeroDev is the only configured wallet provider', () => {
  const config = read('lib/wagmi.ts');
  const provider = read('components/wallet/wallet-provider.tsx');
  const pkg = JSON.parse(read('package.json'));

  assert.match(config, /zeroDevWallet/);
  assert.match(config, /mode: '7702'/);
  assert.match(config, /NEXT_PUBLIC_ZERODEV_PROJECT_ID/);
  assert.match(config, /robinhoodTestnet/);
  assert.match(provider, /ConnectWallet/);
  assert.match(provider, /candidate\.id === 'zerodev-wallet'/);
  assert.equal(pkg.dependencies['@reown/appkit'], undefined);
  assert.equal(pkg.dependencies['@reown/appkit-adapter-wagmi'], undefined);
});

test('ZeroDev keeps an EIP-1193 provider available to existing transaction flows', () => {
  const provider = read('components/wallet/wallet-provider.tsx');

  assert.match(provider, /account\.connector\.getProvider\(\)/);
  assert.match(provider, /provider,/);
});

test('ZeroDev resumes email magic-link authentication after navigation', () => {
  const provider = read('components/wallet/wallet-provider.tsx');

  assert.match(provider, /useAuth\(\)/);
  assert.match(provider, /URLSearchParams\(window\.location\.search\)\.has\('code'\)/);
  assert.match(provider, /authStep !== 'authenticated'/);
  assert.match(provider, /wallet_connection_succeeded/);
  assert.match(provider, /wallet_connection_failed/);
});

test('ZeroDev connection failures cannot leave the blocking login modal open', () => {
  const provider = read('components/wallet/wallet-provider.tsx');

  assert.match(provider, /authStep === 'authenticated'\) setLoginOpen\(false\)/);
  assert.match(provider, /finally \{\s*setLoginOpen\(false\);\s*\}/);
});