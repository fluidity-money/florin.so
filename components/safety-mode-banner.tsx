'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTS } from '../lib/borrow-contract';
import { robinhoodPublicClient } from '../lib/robinhood-client';
import { readSafetyMode, safetyModeNotice } from '../lib/safety-mode';

export function SafetyModeBanner() {
	const [now, setNow] = useState(() => Date.now());
	const query = useQuery({
		queryKey: ['safety-mode', robinhoodPublicClient.chain.id, CONTRACTS.borrowerOperations, CONTRACTS.spyPriceFeed],
		queryFn: () => readSafetyMode(robinhoodPublicClient),
		staleTime: 15_000,
		refetchInterval: 15_000,
		retry: 1,
	});
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1_000);
		return () => clearInterval(timer);
	}, []);
	const notice = safetyModeNotice(query.data, query.isError, Math.max(now, Date.now()));
	return (
		<div role="status" aria-live="polite" aria-atomic="true">
			{notice && <div className="safety-mode-banner">{notice}</div>}
		</div>
	);
}
