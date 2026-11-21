'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MockStrategy } from '../lib/mock-vaults';
import { TokenIcon } from './token-icon';
import { VaultPerformance } from './vault-performance';
import { VaultSimulator } from './vault-simulator';
import styles from './vault-detail.module.css';

const TABS = ['Performance', 'Vault info', 'Strategies', 'Risk'] as const;
type DetailTab = typeof TABS[number];

function VaultInformation({ strategy, tab }: { strategy: MockStrategy; tab: DetailTab }) {
	if (tab === 'Performance') return <VaultPerformance strategy={strategy} />;
	if (tab === 'Vault info') return (
		<section>
			<h2>Vault info</h2><p>{strategy.description}</p>
			<h3>Illustrative fee schedule</h3>
			<dl className={styles.facts}>
				<div><dt>Management fee</dt><dd>0% annually</dd></div>
				<div><dt>Performance fee</dt><dd>10% of gains</dd></div>
				<div><dt>Deposit / withdrawal fees</dt><dd>0%</dd></div>
			</dl>
			<p>These are example terms, not deployed parameters. The simulator does not deduct fees.</p>
			<h3>More info</h3><p>No vault contracts, audits or live strategy integrations are represented by this demo. APYs are fictitious and are not guaranteed returns.</p>
		</section>
	);
	if (tab === 'Strategies') return (
		<section>
			<h2>Strategy allocations</h2><p>Illustrative target weights, not live positions.</p>
			{strategy.allocations.map((allocation) => (
				<div className={styles.allocation} key={allocation.name}>
					<div><span>{allocation.name}</span><strong>{allocation.percent}%</strong></div>
					<progress value={allocation.percent} max={100} aria-label={allocation.name} />
				</div>
			))}
			<p>In this concept, liquidity earns trading fees while an idle reserve supports withdrawals. No rebalancing or yield generation happens in the demo.</p>
		</section>
	);
	return <section><h2>Risks to consider</h2><p>A real strategy could lose principal. Higher estimated APY does not imply lower risk.</p><ul>{strategy.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul><p>This preview is not an audit, risk rating or investment recommendation.</p></section>;
}

export function VaultDetail({ strategy }: { strategy: MockStrategy }) {
	const [tab, setTab] = useState<DetailTab>('Performance');
	return (
		<article className={styles.detail}>
			<nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/vault">Vaults</Link><span aria-hidden="true">/</span><span aria-current="page">{strategy.name}</span></nav>
			<header className={styles.heading}>
				<div className={styles.title}><span className="vault__tokens" aria-hidden="true">{strategy.assets.map((symbol) => <TokenIcon key={symbol} symbol={symbol} size={40} />)}</span><h1>{strategy.name}</h1><span className={styles.badge}>Demo</span></div>
				<p>All metrics, charts, allocations and balances are fictitious. Explore the interface without a wallet or real transactions.</p>
			</header>
			<dl className={styles.metrics}>
				<div><dt>Estimated APY</dt><dd>{strategy.estimatedApy}</dd></div>
				<div><dt>30-day APY</dt><dd>{strategy.monthlyApy}</dd></div>
				<div><dt>Total value locked</dt><dd>{strategy.tvl}</dd></div>
			</dl>
			<div className={styles.layout}>
				<div className={styles.panel}>
					<nav className={styles.controls} aria-label="Vault sections">{TABS.map((value) => <button type="button" key={value} aria-pressed={tab === value} aria-controls="vault-section" onClick={() => setTab(value)}>{value}</button>)}</nav>
					<div id="vault-section" className={styles.content}><VaultInformation strategy={strategy} tab={tab} /></div>
				</div>
				<VaultSimulator />
			</div>
			<Link className={styles.back} href="/vault">← All vault strategies</Link>
		</article>
	);
}
