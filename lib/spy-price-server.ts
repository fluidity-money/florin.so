import 'server-only';

import { unstable_cache } from 'next/cache';
import { formatUnits } from 'viem';
import { CONTRACTS, priceFeedAbi, validatedOraclePrice } from './borrow-contract';
import { robinhoodPublicClient } from './robinhood-client';

// Display-only snapshot. Throw inside the cache callback so a failed refresh
// does not replace a previously valid cached price with a fallback value.
const cachedSpyPrice = unstable_cache(async () => {
  const simulation = await robinhoodPublicClient.simulateContract({
    address: CONTRACTS.spyPriceFeed,
    abi: priceFeedAbi,
    functionName: 'fetchPrice',
  });
  const price = Number(formatUnits(validatedOraclePrice(simulation.result), 18));
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid SPY display price');
  return price;
}, ['spy-display-price', CONTRACTS.spyPriceFeed], { revalidate: 30 });

export async function fetchSpyDisplayPrice(): Promise<number | null> {
  try {
    return await cachedSpyPrice();
  } catch {
    // A cold cache and unavailable oracle must not prevent the page rendering.
    return null;
  }
}
