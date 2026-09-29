import { FLORIN_GRAPH_URL } from './florin-market-query';

export { FLORIN_GRAPH_URL };

export const OPEN_POSITIONS_QUERY = `
  query OpenPositions($owner: Address!) {
    openPositions(owner: $owner) {
      troveId
      troveManager
      owner
      debt
      collateral
      stake
      annualInterestRate
      interestBatchManager
    }
  }
`;
