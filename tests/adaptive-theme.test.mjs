import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('app/globals.css');

test('night palette covers semantic colors and native controls', () => {
  const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
  assert.match(dark, /color-scheme: dark/);
  for (const token of ['ink', 'paper', 'gray-1', 'gray-2', 'gray-3', 'line', 'line-soft', 'sp-biscay', 'sp-hawkes', 'risk-ok', 'risk-warn', 'risk-bad']) {
    assert.match(dark, new RegExp(`--${token}:`));
  }
  assert.match(css, /color-scheme: light/);
  assert.match(dark, /--paper: #1e1e1e/);
  assert.match(dark, /--ink: #eeeeee/);
  assert.match(dark, /\.hero__btn--solid\s*\{ color: #0f3d2e/);
  assert.match(dark, /\.site-footer\s*\{\s*--paper: #eeeeee/);
  assert.match(dark, /\.hero__bg \{ background-image: url\('\/hero-night\.webp'\)/);
  // One theme mechanism: nothing is keyed on the media query directly.
  assert.doesNotMatch(css, /@media \(prefers-color-scheme/);
});

test('inline light defaults do not override adaptive semantic tokens', () => {
  assert.match(read('lib/theme.ts'), /key\.replace\('--', '--light-'\)/);
  assert.match(read('app/layout.tsx'), /<html lang="en" style=\{style\} suppressHydrationWarning>/);
  assert.doesNotMatch(read('app/layout.tsx'), /<body style=/);
  assert.match(css, /--paper: var\(--light-paper, #eeeeee\)/);
});

test('theme is resolved before first paint from the saved choice, else the device', () => {
  const init = read('lib/theme-init.ts');
  assert.match(read('app/layout.tsx'), /<script dangerouslySetInnerHTML=\{\{ __html: THEME_INIT_SCRIPT \}\} \/>/);
  assert.match(init, /localStorage\.getItem\('\$\{THEME_STORAGE_KEY\}'\)/);
  assert.match(init, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(init, /d\.dataset\.theme=saved\(\)\|\|\(m\.matches\?'dark':'light'\)/);
  assert.match(init, /m\.addEventListener\('change',apply\)/);
});

test('footer switch saves a manual choice and the wallet modal follows it', () => {
  const mode = read('lib/theme-mode.ts');
  const footer = read('components/Footer.tsx');
  const wallet = read('components/wallet/wallet-provider.tsx');
  assert.match(mode, /document\.documentElement\.dataset\.theme = mode/);
  assert.match(mode, /localStorage\.setItem\(THEME_STORAGE_KEY, mode\)/);
  assert.match(mode, /removeEventListener\(THEME_EVENT, onChange\)/);
  assert.match(footer, /role="switch"/);
  assert.match(footer, /aria-checked=\{dark\}/);
  assert.match(footer, /setThemeMode\(dark \? 'light' : 'dark'\)/);
  assert.doesNotMatch(wallet, /themeMode="light"/);
  assert.match(wallet, /const themeMode = useThemeMode\(\);/);
  assert.match(wallet, /setThemeMode\(themeMode\);/);
});
