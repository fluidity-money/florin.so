import 'server-only';

const FLORIN_GRAPH_URL = 'https://graph.florin.so';

const MARKET_QUERY = `
  query Markets {
    borrowDetails {
      collateral { name }
      avgRatePa
      deposited
      debtIssued
    }
    earnRewards {
      collateral { name }
      apr
      poolSize
      coverage
    }
  }
`;

export interface BorrowDetails {
  collateral: { name: string };
  avgRatePa: string;
  deposited: string;
  debtIssued: string;
}

export interface EarnRewards {
  collateral: { name: string };
  apr: string;
  poolSize: string;
  coverage: string;
}

export interface FlorinMarkets {
  borrowDetails: BorrowDetails[];
  earnRewards: EarnRewards[];
}

interface GraphResponse {
  data?: Partial<FlorinMarkets> | null;
  errors?: { message: string }[];
}

export async function fetchFlorinMarkets(): Promise<FlorinMarkets> {
  try {
    const response = await fetch(FLORIN_GRAPH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: MARKET_QUERY }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Florin GraphQL returned HTTP ${response.status}`);
    }

    const result = (await response.json()) as GraphResponse;
    if (result.errors?.length || !result.data) {
      throw new Error(result.errors?.map(({ message }) => message).join('; ') || 'missing data');
    }

    return {
      borrowDetails: result.data.borrowDetails ?? [],
      earnRewards: result.data.earnRewards ?? [],
    };
  } catch (error) {
    console.error('Unable to load Florin market data:', error);
    return { borrowDetails: [], earnRewards: [] };
  }
}
