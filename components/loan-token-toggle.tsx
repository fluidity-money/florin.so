'use client';

import { TokenIcon } from './token-icon';

export type LoanToken = 'FUSD' | 'USDG';

// The reel is decorative: only an explicit selection changes the loan token.
const INTRO_TOKENS: readonly LoanToken[] = ['FUSD', 'USDG', 'FUSD', 'USDG', 'FUSD', 'USDG', 'FUSD'];

export function LoanTokenToggle({ value, intro, disabled, onChange, onIntroEnd }: {
	value: LoanToken;
	intro: boolean;
	disabled: boolean;
	onChange: (token: LoanToken) => void;
	onIntroEnd: () => void;
}) {
	const next = value === 'FUSD' ? 'USDG' : 'FUSD';
	return (
		<button
			type="button"
			className="loan-token-toggle swap__tok"
			aria-label={`Loan token ${value}. Switch to ${next}`}
			disabled={disabled}
			onClick={() => { if (!disabled) onChange(next); }}
		>
			<span className="loan-token-toggle__window" aria-hidden="true">
				<span
					className={intro && value === 'FUSD' ? 'loan-token-toggle__reel loan-token-toggle__reel--intro' : 'loan-token-toggle__reel'}
					onAnimationEnd={onIntroEnd}
				>
					{(intro && value === 'FUSD' ? INTRO_TOKENS : [value]).map((token, index) => (
						<span className="loan-token-toggle__row swap__pair" key={index}>
							<TokenIcon symbol={token} size={30} />{token}
						</span>
					))}
				</span>
			</span>
		</button>
	);
}
