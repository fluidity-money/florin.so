import type { PublicClient } from 'viem';
import { CONTRACTS, getApproxHintBatched, sortedTrovesAbi } from './borrow-contract';

/** Resolve insertion hints without sampling an empty sorted-trove list. */
export async function getFormOpeningHints(
	client: Pick<PublicClient, 'readContract'>,
	rateWei: bigint,
	troveCount: bigint,
) {
	if (troveCount <= 0n) return { upperHint: 0n, lowerHint: 0n };
	const approxHint = await getApproxHintBatched(client, rateWei, troveCount);
	const [upperHint, lowerHint] = await client.readContract({
		address: CONTRACTS.sortedTroves,
		abi: sortedTrovesAbi,
		functionName: 'findInsertPosition',
		args: [rateWei, approxHint, approxHint],
	});
	return { upperHint, lowerHint };
}
