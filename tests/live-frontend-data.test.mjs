import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('home and stability pages use the existing event-backed market query', () => {
  const home = read('app/page.tsx');
  const hero = read('components/hero.tsx');
  const stabilityPage = read('app/stability/page.tsx');
  const stability = read('components/stability-pool.tsx');

  assert.match(home, /await fetchFlorinMarkets\(\)/);
  assert.match(home, /<Hero markets=\{markets\}/);
  assert.doesNotMatch(hero, /mockData|PROTOCOL_STATS/);
  assert.match(hero, /useFlorinMarkets\(markets\)/);
  assert.match(hero, /spyMarket\(liveMarkets\)/);

  assert.match(stabilityPage, /await fetchFlorinMarkets\(\)/);
  assert.match(stabilityPage, /<StabilityPool initialMarkets=\{/);
  assert.doesNotMatch(stability, /mockData|PROTOCOL_STATS|stabilityPoolApr|ANNUAL_INTEREST_FUSD/);
  assert.match(stability, /rewards\?\.poolSize/);
  assert.match(stability, /rewards\?\.apr/);
  assert.match(stability, /rewards\?\.coverage/);
});

test('SPY price and wallet balances come from Robinhood contracts without constants', () => {
  const price = read('lib/use-spy-price.ts');
  const balances = read('lib/use-wallet-balances.ts');
  const footer = read('components/Footer.tsx');

  assert.match(price, /CONTRACTS\.spyPriceFeed/);
  assert.match(price, /functionName:\s*'lastGoodPrice'/);
  assert.doesNotMatch(price, /SPY_PRICE_USD|mockData|CoinGecko/);
  assert.match(balances, /CONTRACTS\.spyToken/);
  assert.match(balances, /CONTRACTS\.boldToken/);
  assert.match(balances, /functionName:\s*'balanceOf'/);
  assert.match(balances, /setBalances\(\{ \.\.\.EMPTY_BALANCES, loading: true \}\)/);
  assert.match(balances, /setBalances\(\{ \.\.\.EMPTY_BALANCES, error: true \}\)/);
  assert.match(balances, /setInterval\(refresh, 15_000\)/);
  assert.match(footer, /ONCHAIN/);
  assert.doesNotMatch(footer, /COINGECKO|FALLBACK/);
  assert.equal(existsSync(new URL('../lib/mockData.ts', import.meta.url)), false);
  assert.equal(existsSync(new URL('../app/api/spy-price/route.ts', import.meta.url)), false);
});

test('position screens do not present local state changes as transactions', () => {
  const manage = read('components/manage-position.tsx');
  const stability = read('components/stability-pool.tsx');

  assert.match(manage, /useWalletBalances\(w\.address\)/);
  assert.doesNotMatch(manage, /MOCK_WALLET|queueAhead|RATE_BOOK_TOTAL|AVG_RATE/);
  assert.doesNotMatch(manage, /setCollateral\(nextCollateral\)|setDebt\(nextDebt\)|setHasClosed\(true\)/);
  assert.match(manage, /Position transactions coming soon/);
  assert.match(manage, /priceReady/);
  assert.match(manage, /oracle unavailable/);

  assert.match(stability, /const wallet = useWallet\(\)/);
  assert.doesNotMatch(stability, /setDeposited/);
  assert.match(stability, /provideToSP/);
  assert.match(stability, /withdrawFromSP/);
});

test('all borrower screens use one 110 percent collateral ratio', () => {
  const constants = read('lib/protocol-constants.ts');
  const open = read('components/open-position-form.tsx');
  const manage = read('components/manage-position.tsx');
  const risks = read('components/risk-list.tsx');

  assert.match(constants, /MIN_COLLATERAL_RATIO\s*=\s*1\.1/);
  assert.match(open, /MIN_COLLATERAL_RATIO/);
  assert.match(manage, /MIN_COLLATERAL_RATIO/);
  assert.match(risks, /MIN_COLLATERAL_RATIO/);
  assert.doesNotMatch(open, /const MCR\s*=/);
});

test('fake redemption queue amounts are removed until the graph exposes them', () => {
  const open = read('components/open-position-form.tsx');
  const manage = read('components/manage-position.tsx');

  assert.doesNotMatch(open, /queueAhead|RATE_BOOK_TOTAL|Redeemable before you/);
  assert.doesNotMatch(manage, /queueAhead|RATE_BOOK_TOTAL|Redeemable before you/);
  assert.match(open, /marketAverageRate/);
  assert.match(manage, /marketAverageRate/);
});

test('SPY rows are selected by collateral name and Max includes the upfront fee', () => {
  const markets = read('lib/florin-markets.ts');
  const open = read('components/open-position-form.tsx');

  assert.match(markets, /collateral\.name === 'SPY'/);
  assert.match(open, /open-trove-max-fee/);
  assert.match(open, /maxTotalDebtWei - \(maxBorrowFee\.data \?\? 0n\)/);
  assert.doesNotMatch(open, /const maxBorrow = collateralUsd \/ MIN_COLLATERAL_RATIO/);
});
