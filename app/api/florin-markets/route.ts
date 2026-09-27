import { NextResponse } from 'next/server';
import { fetchFreshFlorinMarkets } from '../../../lib/florin-graph';

const NO_STORE = { 'cache-control': 'no-store, must-revalidate' };

export async function GET() {
  try {
    const markets = await fetchFreshFlorinMarkets();
    return NextResponse.json(markets, { headers: NO_STORE });
  } catch (error) {
    console.error('Unable to refresh Florin market data:', error);
    return NextResponse.json(
      { error: 'Unable to refresh Florin market data' },
      { status: 502, headers: NO_STORE },
    );
  }
}
