import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('app/globals.css');

test('automatic dark palette covers semantic colors and native controls', () => {
  const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
  assert.match(dark, /color-scheme: dark/);
  for (const token of ['ink', 'paper', 'gray-1', 'gray-2', 'gray-3', 'line', 'line-soft', 'sp-biscay', 'sp-hawkes', 'risk-ok', 'risk-warn', 'risk-bad']) {
    assert.match(dark, new RegExp(`--${token}:`));
  }
  assert.match(css, /color-scheme: light/);
  assert.match(dark, /\.hero__btn--solid\s*\{ color: #0f3d2e/);
  assert.match(dark, /\.site-footer\s*\{\s*--paper: #eeeeee/);
});

test('inline light defaults do not override adaptive semantic tokens', () => {
  assert.match(read('lib/theme.ts'), /key\.replace\('--', '--light-'\)/);
  assert.match(read('app/layout.tsx'), /<html lang="en" style=\{style\}>/);
  assert.doesNotMatch(read('app/layout.tsx'), /<body style=/);
  assert.match(css, /--paper: var\(--light-paper, #eeeeee\)/);
});

test('wallet theme follows live system preference and cleans up its listener', () => {
  const wallet = read('components/wallet/wallet-provider.tsx');
  assert.doesNotMatch(wallet, /themeMode="light"/);
  assert.match(wallet, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(wallet, /setThemeMode\(preference.matches \? 'dark' : 'light'\)/);
  assert.match(wallet, /addEventListener\('change', syncTheme\)/);
  assert.match(wallet, /removeEventListener\('change', syncTheme\)/);
});
