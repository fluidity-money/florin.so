'use client';

import { useState, type FormEvent } from 'react';
import { simulateVaultAction, type DemoMode } from '../lib/mock-vaults';
import styles from './vault-detail.module.css';

export function VaultSimulator() {
	const [mode, setMode] = useState<DemoMode>('deposit');
	const [amount, setAmount] = useState('');
	const [funds, setFunds] = useState({ balance: 100000, position: 25000 });
	const [feedback, setFeedback] = useState('');
	const available = mode === 'deposit' ? funds.balance : funds.position;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const result = simulateVaultAction(funds, mode, amount);
		setFeedback(result.message);
		if (result.ok) {
			setFunds(result.state);
			setAmount('');
		}
	}

	return (
		<aside className={styles.panel} aria-label="Vault simulator">
			<h2>Try the vault</h2>
			<p>Demo only. No wallet connection or real funds are used.</p>
			<div className={styles.controls} aria-label="Simulation action">
				{(['deposit', 'withdraw'] as const).map((value) => (
					<button type="button" key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setAmount(''); setFeedback(''); }}>{value === 'deposit' ? 'Deposit' : 'Withdraw'}</button>
				))}
			</div>
			<form onSubmit={submit} noValidate>
				<label htmlFor="vault-amount">{mode === 'deposit' ? 'Deposit' : 'Withdraw'} amount · FUSD</label>
				<div className={styles.amount}>
					<input id="vault-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(event) => { setAmount(event.target.value); setFeedback(''); }} aria-describedby="vault-amount-help" />
					<button type="button" onClick={() => { setAmount((available / 100).toFixed(2)); setFeedback(''); }}>Max</button>
				</div>
				<p id="vault-amount-help">Available to {mode}: {(available / 100).toFixed(2)} simulated FUSD. Up to 2 decimal places.</p>
				<button className={styles.primary} type="submit">Simulate {mode}</button>
				<p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>
			</form>
			<h3>My demo info</h3>
			<dl className={styles.facts}>
				<div><dt>Simulated balance</dt><dd>{(funds.balance / 100).toFixed(2)} FUSD</dd></div>
				<div><dt>Simulated position</dt><dd>{(funds.position / 100).toFixed(2)} FUSD</dd></div>
			</dl>
			<p>FUSD-only simulation at 1:1, with no fees or yield accrual. Balances reset when you leave this strategy or reload.</p>
		</aside>
	);
}
