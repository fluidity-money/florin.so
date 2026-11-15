'use client';

import { useEffect, useState } from 'react';
import { getMarketPauseReason, MARKET_CLOSED_TITLE } from '../lib/transaction-error';

// Rendered only when the on-chain feed reports a pause. The calendar explains
// scheduled pauses; it never enables or disables protocol actions.
export function MarketClosedNotice({ paused }: { paused: string }) {
	const [now, setNow] = useState<number>();
	useEffect(() => {
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), 1_000);
		return () => clearInterval(timer);
	}, []);
	const reason = now === undefined ? undefined : getMarketPauseReason(now);

	return (
		<p className="swap__over" role="status">
			<b>{MARKET_CLOSED_TITLE}</b> {reason && <>{reason} </>}
			{paused} paused until the on-chain market pause is lifted.
		</p>
	);
}
