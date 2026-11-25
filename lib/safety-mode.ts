import { parseAbi, type PublicClient } from 'viem';
import { CONTRACTS, priceFeedAbi, validatedOraclePrice } from './borrow-contract';

const branchAbi = parseAbi([
	'function CCR() view returns (uint256)',
	'function getEntireBranchColl() view returns (uint256)',
	'function getEntireBranchDebt() view returns (uint256)',
]);
export const SAFETY_MODE_MAX_AGE_MS = 30_000;
export type SafetyModeState = {
	active: boolean;
	readAt: number;
};

// Matches LiquityBase._checkBelowCriticalThreshold: equality is normal mode;
// a branch with no debt has an effectively infinite collateral ratio.
export function isBelowCriticalRatio(collateral: bigint, debt: bigint, price: bigint, ccr: bigint): boolean {
	if (collateral < 0n || debt < 0n || price <= 0n || ccr <= 0n) {
		throw new Error('Invalid safety-mode inputs.');
	}
	return debt > 0n && collateral * price / debt < ccr;
}

export async function readSafetyMode(client: Pick<PublicClient, 'getBlock' | 'readContract' | 'simulateContract'>): Promise<SafetyModeState> {
	const readAt = Date.now();
	const block = await client.getBlock({ blockTag: 'latest' });
	if (block.number === null || !block.hash) throw new Error('Safety-mode block unavailable.');
	const blockNumber = block.number;
	const read = (functionName: 'CCR' | 'getEntireBranchColl' | 'getEntireBranchDebt') =>
		client.readContract({ address: CONTRACTS.borrowerOperations, abi: branchAbi, functionName, blockNumber });
	const [ccr, collateral, debt, oracle] = await Promise.all([
		read('CCR'), read('getEntireBranchColl'), read('getEntireBranchDebt'),
		client.simulateContract({ address: CONTRACTS.spyPriceFeed, abi: priceFeedAbi, functionName: 'fetchPrice', blockNumber }),
	]);
	const active = isBelowCriticalRatio(collateral, debt, validatedOraclePrice(oracle.result), ccr);
	const canonical = await client.getBlock({ blockNumber });
	if (canonical.hash !== block.hash) throw new Error('Safety-mode block changed.');
	if (Date.now() - readAt > SAFETY_MODE_MAX_AGE_MS) throw new Error('Safety-mode read expired.');
	return { active, readAt };
}

export function safetyModeNotice(data: SafetyModeState | undefined, isError: boolean, now: number) {
	if (isError || (data && (now - data.readAt > SAFETY_MODE_MAX_AGE_MS || now < data.readAt))) {
		return null;
	}
	if (!data?.active) return null;
	return 'Safety mode is active. The SPY branch’s total collateral ratio is below its critical threshold. Borrowing and collateral withdrawals are restricted; adding collateral or repaying debt helps restore the ratio.';
}
