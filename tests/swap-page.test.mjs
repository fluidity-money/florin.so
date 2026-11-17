import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadSwapHelpers() {
  const source = read('lib/swap.ts');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript,${encodeURIComponent(js)}`);
}

test('swap page is unlisted: not in the navigation and not indexed', () => {
  const page = read('app/swap/page.tsx');
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.doesNotMatch(read('components/Header.tsx'), /['"]\/swap['"]/);
  assert.doesNotMatch(read('components/Footer.tsx'), /['"]\/swap['"]/);
  assert.doesNotMatch(read('app/page.tsx'), /['"]\/swap['"]/);
});

test('swap offers SPY, USDG and frxUSD against FUSD, routed through Uniswap', async () => {
  const swap = await loadSwapHelpers();
  assert.deepEqual([...swap.SWAP_ASSETS].sort(), ['SPY', 'USDG', 'frxUSD'].sort());
  for (const asset of swap.SWAP_ASSETS) {
    const pool = swap.poolFor(asset, 'FUSD');
    assert.ok(pool, `pool for ${asset}/FUSD`);
    assert.equal(pool.venue, 'Uniswap');
  }
  assert.match(read('components/swap-page.tsx'), /Provide liquidity/);
});

test('the preview prices SPY at the oracle and stablecoins at a dollar', async () => {
  const swap = await loadSwapHelpers();
  assert.equal(swap.estimateOutput('USDG', 'FUSD', 100, 740), 100);
  assert.equal(swap.estimateOutput('SPY', 'FUSD', 2, 740), 1480);
  assert.equal(swap.estimateOutput('FUSD', 'SPY', 740, 740), 1);
  assert.equal(swap.estimateOutput('SPY', 'FUSD', 1, 0), null);
  assert.equal(swap.estimateOutput('USDG', 'FUSD', 0, 740), null);
  assert.equal(swap.minimumReceived(1000, 0.005), 995);
});

test('the swap button stays disabled until the backend wires the swap', () => {
  assert.match(read('components/swap-page.tsx'), /<Button variant="primary" disabled>Swaps open soon<\/Button>/);
});
