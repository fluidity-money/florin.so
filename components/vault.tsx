'use client';

import { useState } from 'react';
import { Token, TokenIcon } from './token-icon';
import { Button } from './ui';

type VaultAsset = 'FUSD' | 'USDG';
type VaultMode = 'deposit' | 'withdraw';

// Presentation only until the Yearn fork's vault and asset adapter are wired.
// Never use Stability Pool balances, APRs or transaction handlers for this vault.
export function Vault() {
	const [asset, setAsset] = useState<VaultAsset>('FUSD');
	const [mode, setMode] = useState<VaultMode>('deposit');
	const [amount, setAmount] = useState('');
	const nextAsset = asset === 'FUSD' ? 'USDG' : 'FUSD';
	const actionLabel = mode === 'deposit' ? 'Deposit' : 'Withdraw';
	const toggleAsset = () => setAsset(nextAsset);

	return (
		<div className="swap">
			<h1 className="swap__title">
				<span>Earn rewards with</span>
				<button
					type="button"
					className="loan-token-toggle swap__tok"
					aria-label={`Vault asset ${asset}. Switch to ${nextAsset}`}
					onClick={toggleAsset}
				>
					<span className="swap__pair"><TokenIcon symbol={asset} size={30} />{asset}</span>
				</button>
			</h1>
			<p className="swap__sub">lorum ipsum</p>

			<div className="pool">
				<div className="pool__head">
					<div className="pool__ident">
						<TokenIcon symbol="FUSD" size={30} />
						<span>
							<span className="pool__name">yFUSD share</span>
							<span className="pool__tvl">TVL <b>—</b> FUSD</span>
						</span>
					</div>
					<div className="pool__aprs">
						<span>APR <b>—</b></span>
						<span className="pool__apr-sub">7d APR <b>—</b></span>
					</div>
				</div>
				<div className="pool__foot">
					<span className="tok-row">Deposit <Token symbol={asset} size={16} /></span>
					<span className="tok-row">Shares <TokenIcon symbol="FUSD" size={16} /> yFUSD</span>
				</div>
			</div>

			<div className="pool">
				<div className="pool__head">
					<div className="pool__ident">
						<TokenIcon symbol="FUSD" size={30} />
						<span>
							<span className="pool__name">Your vault position</span>
							<span className="pool__tvl">Shares <b>—</b> yFUSD</span>
						</span>
					</div>
					<div className="pool__aprs"><span>Value <b>—</b> {asset}</span></div>
				</div>
			</div>

			<div className="pool-tabs" role="group" aria-label="Vault action">
				{(['deposit', 'withdraw'] as const).map((option) => (
					<button
						key={option}
						type="button"
						className={mode === option ? 'pool-tabs__tab pool-tabs__tab--on' : 'pool-tabs__tab'}
						aria-pressed={mode === option}
						onClick={() => {
							setMode(option);
							setAmount('');
						}}
					>
						{option === 'deposit' ? 'Deposit' : 'Withdraw'}
					</button>
				))}
			</div>

			<div className="swap__field">
				<div className="swap__row"><span className="swap__label">{actionLabel} amount</span></div>
				<div className="swap__row">
					<input
						className="swap__amount"
						inputMode="decimal"
						placeholder="0.00"
						value={amount}
						onChange={(event) => setAmount(event.target.value)}
						aria-label={`${asset} to ${mode}`}
					/>
					<button type="button" className="swap__max" disabled>Max</button>
					<button
						type="button"
						className="swap__pill"
						aria-label={`Amount asset ${asset}. Switch to ${nextAsset}`}
						onClick={toggleAsset}
					>
						<Token symbol={asset} size={18} />
					</button>
				</div>
				<span className="swap__usd">Balance unavailable until vault integration</span>
			</div>

			<details className="swap__note">
				<summary>What the pool actually does</summary>
				<p>lorum ipsum</p>
			</details>
			<p className="swap__usd">Yearn vault integration coming soon. Deposits and withdrawals are not enabled yet.</p>
			<Button variant="primary" disabled>{actionLabel} {asset} — coming soon</Button>
		</div>
	);
}
