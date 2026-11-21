'use client';

import { useState, useId } from 'react';
import { mockChartValues, type MockStrategy, type ChartMetric, type ChartPeriod } from '../lib/mock-vaults';
import styles from './vault-detail.module.css';

export function VaultPerformance({ strategy }: { strategy: MockStrategy }) {
	const [metric, setMetric] = useState<ChartMetric>('APY');
	const [period, setPeriod] = useState<ChartPeriod>('30D');
	const summaryId = useId();
	const values = mockChartValues(strategy, metric, period);
	const min = Math.min(...values) * 0.98;
	const max = Math.max(...values) * 1.02;
	const points = values.map((value, index) => `${20 + index * 80},${180 - (value - min) / (max - min) * 150}`).join(' ');
	const format = (value: number) => metric === 'APY' ? `${value.toFixed(2)}%` : `$${Math.round(value).toLocaleString('en-US')}`;

	return (
		<section aria-label="Mock performance">
			<h2>Performance</h2>
			<div className={styles.chartControls}>
				<div className={styles.controls} aria-label="Chart metric">
					{(['APY', 'TVL'] as const).map((value) => <button type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}>{value}</button>)}
				</div>
				<div className={styles.controls} aria-label="Chart timeframe">
					{(['7D', '30D', '90D'] as const).map((value) => <button type="button" key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value}</button>)}
				</div>
			</div>
			<svg className={styles.chart} viewBox="0 0 520 210" role="img" aria-label={`Illustrative ${metric} over ${period}`} aria-describedby={summaryId}>
				<path d="M20 30H500 M20 105H500 M20 180H500" className={styles.gridline} />
				<polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
				<text x="20" y="205">{period} ago</text><text x="500" y="205" textAnchor="end">Demo today</text>
			</svg>
			<p id={summaryId} aria-live="polite">Fictitious {period} {metric}: {format(values[0])} to {format(values[values.length - 1])}. Range {format(Math.min(...values))}–{format(Math.max(...values))}. This is not historical performance.</p>
		</section>
	);
}
