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

test('first-time visitors see a dismissible faucet tooltip and receive a cookie', () => {
  const hero = read('components/hero.tsx');
  const styles = read('app/globals.css');

  assert.match(hero, /florin_faucet_intro_seen/);
  assert.match(hero, /document\.cookie/);
  assert.match(hero, /Start your testnet journey here/);
  assert.match(hero, /aria-label="Dismiss faucet introduction"/);
  assert.match(styles, /\.hero__faucet-tip\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('the X follow button sits below the primary actions and is feature flagged', () => {
  const hero = read('components/hero.tsx');
  const styles = read('app/globals.css');

  assert.match(hero, /useFeature\('show x follow button'\)/);
  assert.match(hero, /showXFollowButton &&/);
  assert.match(hero, /https:\/\/x\.com\/florinprotocol/);
  assert.match(hero, /Follow florinprotocol on X/);
  assert.match(styles, /\.hero__cta-row\s*\{/);
});
