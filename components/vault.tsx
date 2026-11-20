import { TokenIcon, type TokenSymbol } from './token-icon';

type MockStrategy = {
	name: string;
	assets: readonly [TokenSymbol, TokenSymbol];
	estimatedApy: string;
	tvl: string;
};

// Display-only fixtures, not live quotes, balances or deployed vault metadata.
const MOCK_STRATEGIES: readonly MockStrategy[] = [
	{ name: 'USDG/FUSD', assets: ['USDG', 'FUSD'], estimatedApy: '8.42%', tvl: '$1,245,000' },
	{ name: 'SPY/FUSD', assets: ['SPY', 'FUSD'], estimatedApy: '12.68%', tvl: '$836,500' },
];

export function Vault() {
	return (
		<section className="vault" aria-labelledby="vault-title">
			<h1 id="vault-title" className="vault__title">Vault strategies</h1>
			<p id="vault-preview" className="vault__intro">Preview with demo values. APY and TVL are illustrative, not live. Deposits and withdrawals are not enabled yet.</p>
			<table className="vault__grid" aria-describedby="vault-preview">
				<caption className="vault__caption">Available strategy previews</caption>
				<thead>
					<tr><th scope="col">Strategy</th><th scope="col">Estimated APY</th><th scope="col">TVL</th></tr>
				</thead>
				<tbody>
					{MOCK_STRATEGIES.map((strategy) => (
						<tr key={strategy.name}>
							<th scope="row">
								<span className="vault__strategy">
									<span className="vault__tokens" aria-hidden="true">
										{strategy.assets.map((symbol) => <TokenIcon key={symbol} symbol={symbol} size={28} />)}
									</span>
									{strategy.name}
								</span>
							</th>
							<td><span className="vault__mobile-label" aria-hidden="true">Estimated APY</span><span>{strategy.estimatedApy}</span></td>
							<td><span className="vault__mobile-label" aria-hidden="true">TVL</span><span>{strategy.tvl}</span></td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
