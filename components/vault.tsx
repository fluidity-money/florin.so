import Link from 'next/link';
import { TokenIcon } from './token-icon';
import { MOCK_STRATEGIES } from '../lib/mock-vaults';

export function Vault() {
	return (
		<section className="vault" aria-labelledby="vault-title">
			<h1 id="vault-title" className="vault__title">Vault strategies</h1>
			<table className="vault__grid">
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
									<Link className="vault__link" href={`/vault/${strategy.slug}`}>{strategy.name}</Link>
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
