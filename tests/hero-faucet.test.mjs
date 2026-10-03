import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the Florin SPY faucet is a distinct highlighted call to action', () => {
  const hero = read('components/hero.tsx');
  const styles = read('app/globals.css');

  assert.match(hero, /hero__btn--faucet/);
  assert.match(hero, /Florin SPY Faucet/);
  assert.match(styles, /\.hero__btn--faucet\s*\{/);
  assert.match(styles, /\.hero__btn--faucet:hover\s*\{/);
});

test('first-time visitors see a feature-flagged faucet call-to-action popup', () => {
  const hero = read('components/hero.tsx');
  const styles = read('app/globals.css');

  assert.match(hero, /useFeature\('show-call-to-action-faucet'\)/);
  assert.match(hero, /if \(!showFaucetCallToAction\) return;/);
  assert.match(hero, /showFaucetCallToAction && \(\s*<dialog/);
  assert.match(hero, /florin_faucet_intro_seen/);
  assert.match(hero, /document\.cookie/);
  assert.match(hero, /Visit the Faucet to get started on your Testnet journey\./);
  assert.match(hero, />\s*Visit the Faucet\s*</);
  assert.match(hero, /href="https:\/\/faucet\.florin\.so"/);
  assert.match(hero, /aria-label="Dismiss faucet introduction"/);
  assert.match(styles, /\.faucet-intro\s*\{/);
  assert.match(styles, /\.faucet-intro__cta\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('the X follow button sits below the primary actions and is feature flagged', () => {
  const hero = read('components/hero.tsx');
  const styles = read('app/globals.css');

  assert.match(hero, /useFeature\('show-x-follow-button'\)/);
  assert.match(hero, /showXFollowButton &&/);
  assert.match(hero, /https:\/\/x\.com\/florinprotocol/);
  assert.match(hero, /Follow @florinprotocol on X/);
  assert.match(styles, /\.hero__cta-row\s*\{/);
});
