export const FLORIN_GRAPH_URL = 'https://graph.superposition.so/florin';

export const MARKET_QUERY = `
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
