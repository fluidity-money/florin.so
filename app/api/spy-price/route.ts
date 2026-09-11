// Live price for the SPY stock token, proxied from CoinGecko.
//
// Server-side rather than fetched from the browser: it keeps the key-free
// public endpoint behind one cached call instead of one per visitor, and it
// means a CoinGecko outage degrades to the fallback constant rather than a
// CORS error in the console.
//
// This is a stand-in. The real read is the Chainlink feed on Robinhood Chain,
// which reports price per token with the corporate-action multiplier already
// applied. Swapping this route for that feed is the seam.

const COIN_ID = 'spdr-s-p-500-etf-trust-robinhood-tokenized-stock';

export const revalidate = 60;

export async function GET() {
  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${COIN_ID}` +
    '&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true';

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`coingecko ${res.status}`);

    const row = (await res.json())?.[COIN_ID];
    if (typeof row?.usd !== 'number') throw new Error('no usd price in response');

    return Response.json({
      usd: row.usd,
      change24h: typeof row.usd_24h_change === 'number' ? row.usd_24h_change : null,
      updatedAt: row.last_updated_at ?? null,
      live: true,
    });
  } catch {
    // The client falls back to SPY_PRICE_USD when live is false.
    return Response.json({ usd: null, change24h: null, updatedAt: null, live: false });
  }
}
