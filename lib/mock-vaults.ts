import type { TokenSymbol } from '../components/token-icon';

export type MockStrategy = {
	slug: string;
	name: string;
	assets: readonly [TokenSymbol, TokenSymbol];
	estimatedApy: string;
	monthlyApy: string;
	tvl: string;
	apy: number;
	totalValue: number;
	description: string;
	allocations: readonly { name: string; percent: number }[];
	risks: readonly string[];
};

// Fictitious presentation data only. No deployed contracts or live quotes.
export const MOCK_STRATEGIES: readonly MockStrategy[] = [
	{
		slug: 'usdg-fusd', name: 'USDG/FUSD', assets: ['USDG', 'FUSD'],
		estimatedApy: '8.42%', monthlyApy: '7.96%', tvl: '$1,245,000', apy: 8.42, totalValue: 1245000,
		description: 'An illustrative stable-asset strategy combining USDG and FUSD liquidity with a reserve for withdrawals. Returns shown here are invented, not forecasts.',
		allocations: [{ name: 'USDG/FUSD liquidity', percent: 80 }, { name: 'FUSD reserve', percent: 20 }],
		risks: ['Either stable asset may lose its peg.', 'Liquidity can be insufficient when withdrawals are requested.', 'Smart-contract failures could cause a total loss in a real implementation.'],
	},
	{
		slug: 'spy-fusd', name: 'SPY/FUSD', assets: ['SPY', 'FUSD'],
		estimatedApy: '12.68%', monthlyApy: '11.84%', tvl: '$836,500', apy: 12.68, totalValue: 836500,
		description: 'An illustrative equity-linked strategy pairing SPY exposure with FUSD liquidity. The mock allocation balances market exposure and a withdrawal reserve; it does not represent an operating vault.',
		allocations: [{ name: 'SPY/FUSD liquidity', percent: 70 }, { name: 'FUSD reserve', percent: 30 }],
		risks: ['SPY price movements and impermanent loss can reduce the position value.', 'Market closures and token redemption constraints may limit liquidity.', 'FUSD depegging, oracle failures and smart-contract failures can cause losses.'],
	},
];

export function getMockStrategy(slug: string) {
	return MOCK_STRATEGIES.find((strategy) => strategy.slug === slug);
}

export type DemoPosition = { balance: number; position: number };
export type DemoMode = 'deposit' | 'withdraw';

// Integer cents keep the deliberately simple FUSD-only simulator predictable.
export function simulateVaultAction(state: DemoPosition, mode: DemoMode, amount: string) {
	if (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim())) {
		return { state, message: 'Enter a positive decimal amount with at most 2 decimal places.', ok: false };
	}
	const cents = Math.round(Number(amount) * 100);
	if (!Number.isSafeInteger(cents) || cents <= 0) {
		return { state, message: 'Enter a finite positive amount.', ok: false };
	}
	const available = mode === 'deposit' ? state.balance : state.position;
	if (cents > available) return { state, message: 'Insufficient simulated balance.', ok: false };
	const delta = mode === 'deposit' ? cents : -cents;
	return {
		state: { balance: state.balance - delta, position: state.position + delta },
		message: `Simulated ${mode} of ${(cents / 100).toFixed(2)} FUSD. No transaction was sent.`, ok: true,
	};
}

export type ChartMetric = 'APY' | 'TVL';
export type ChartPeriod = '7D' | '30D' | '90D';
export function mockChartValues(strategy: MockStrategy, metric: ChartMetric, period: ChartPeriod) {
	const base = metric === 'APY' ? strategy.apy : strategy.totalValue;
	const scale = { '7D': 0.03, '30D': 0.08, '90D': 0.16 }[period];
	const shape = metric === 'APY' ? [-2, -1, -1.5, 0.3, -0.5, 0.5, 0] : [-3, -2.5, -1, -1.4, -0.4, -0.7, 0];
	return shape.map((offset) => base * (1 + offset * scale));
}
