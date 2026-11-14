export type TransactionFailureStage =
  | 'connecting'
  | 'switching'
  | 'preparing'
  | 'signing-permit'
  | 'wrapping'
  | 'approving-weth'
  | 'approving'
  | 'opening'
  | 'confirming';

export type TransactionErrorDescription = {
  title: string;
  explanation: string;
  technicalDetails: string;
  code?: string;
  stage: TransactionFailureStage;
};

type ErrorDetails = {
  messages: string[];
  reasons: string[];
  unauthorized?: boolean;
  code?: string;
};

const MAX_DETAIL_LENGTH = 1_200;

// Florin follows NYSE hours. Outside them BorrowerOperations reverts with
// StockPaused() (0x1a21f1f2) and TroveManager with StockMarketPaused()
// (0x68832e02). Wallets often only report the selector, so match both forms.
export const MARKET_CLOSED_TITLE = 'US markets are closed.';
export const MARKET_CLOSED_EXPLANATION =
  'Florin follows NYSE trading hours, so opening positions, borrowing more and withdrawing collateral are paused while the market is closed, including weekends and holidays. They resume when the NYSE opens, 9:30 ET on trading days. Adding collateral, repaying and Earn still work.';

export function isMarketClosedError(error: unknown): boolean {
  const details = collectErrorDetails(error);
  const searchable = [...details.messages, ...details.reasons].join(' ').toLowerCase();
  return /stockpaused|stockmarketpaused|0x1a21f1f2|0x68832e02/.test(searchable);
}
const CONTRACT_REASON_EXPLANATIONS: Record<string, string> = {
  ICRBelowMCR: 'The position’s collateral ratio is below the protocol minimum. Add more SPY or borrow less FUSD.',
  ICRBelowMCRPlusBCR: 'The position needs a larger collateral buffer. Add more SPY or borrow less FUSD.',
  DebtBelowMin: 'The requested loan is below the protocol minimum.',
  TCRBelowCCR: 'Opening this position would push the protocol below its required system collateral ratio.',
  UpfrontFeeTooHigh: 'The onchain upfront fee increased beyond the quoted maximum. Refresh the quote and try again.',
  InterestRateTooLow: 'The selected interest rate is below the protocol minimum.',
  InterestRateTooHigh: 'The selected interest rate is above the protocol maximum.',
  TroveExists: 'A position with the generated identifier already exists. Retrying will generate a new identifier.',
  NewOracleFailureDetected: 'The SPY price oracle reported a new failure, so the protocol refused to open a position.',
  IsShutDown: 'The protocol is currently shut down and is not accepting new positions.',
};

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function addUnique(values: string[], value: unknown) {
  if (typeof value !== 'string') return;
  const cleaned = clean(value);
  if (cleaned && !values.includes(cleaned)) values.push(cleaned);
}

function collectErrorDetails(error: unknown): ErrorDetails {
  const details: ErrorDetails = { messages: [], reasons: [] };
  const seen = new Set<object>();

  function visit(value: unknown, depth: number) {
    if (depth > 6 || value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);

    const candidate = value as Record<string, unknown>;
    addUnique(details.messages, candidate.shortMessage);
    addUnique(details.messages, candidate.details);
    addUnique(details.messages, candidate.message);
    addUnique(details.reasons, candidate.reason);
    addUnique(details.reasons, candidate.errorName);

    if (details.code === undefined && (typeof candidate.code === 'string' || typeof candidate.code === 'number')) {
      details.code = String(candidate.code);
    }

    if (candidate.code === 4100 || candidate.code === '4100') details.unauthorized = true;

    visit(candidate.data, depth + 1);
    visit(candidate.cause, depth + 1);
  }

  if (typeof error === 'string') addUnique(details.messages, error);
  visit(error, 0);
  return details;
}

export function describeTransactionError(
  error: unknown,
  stage: TransactionFailureStage,
): TransactionErrorDescription {
  const details = collectErrorDetails(error);
  const allDetails = [...details.messages, ...details.reasons];
  const technicalDetails = (allDetails.join(' — ') || 'Unknown wallet or network error.')
    .slice(0, MAX_DETAIL_LENGTH);
  const searchable = `${details.code ?? ''} ${technicalDetails}`.toLowerCase();
  const reason = details.reasons[0];

  if (details.unauthorized || /requested method and\/or account has not been authorized/.test(searchable)) {
    return {
      title: 'Reconnect your wallet.',
      explanation: 'Disconnect and reconnect your wallet to authorize the account displayed in Florin. In MetaMask, allow this site to access that account, then try again.',
      technicalDetails,
      code: '4100',
      stage,
    };
  }

  if (details.code === '4001' || /user (rejected|denied)|rejected the request|request rejected/.test(searchable)) {
    return {
      title: stage === 'signing-permit' ? 'Permit signature cancelled.' : 'Transaction cancelled.',
      explanation: 'You rejected the request in your wallet. No transaction was submitted.',
      technicalDetails,
      code: details.code,
      stage,
    };
  }

  if (/insufficient funds|exceeds balance|not enough funds/.test(searchable)) {
    return {
      title: 'Not enough ETH.',
      explanation: 'Your wallet needs 0.001 ETH for liquidator compensation, plus ETH for network fees.',
      technicalDetails,
      code: details.code,
      stage,
    };
  }

  if (/stockpaused|stockmarketpaused|0x1a21f1f2|0x68832e02/.test(searchable)) {
    return {
      title: MARKET_CLOSED_TITLE,
      explanation: `${MARKET_CLOSED_EXPLANATION} Nothing was changed.`,
      technicalDetails,
      code: details.code,
      stage,
    };
  }

  if (/revert|reverted/.test(searchable)) {
    const approval = stage === 'approving';
    const wethApproval = stage === 'approving-weth';
    const wrapping = stage === 'wrapping';
    const action = wrapping ? 'wrap ETH into WETH' : wethApproval ? 'WETH approval' : approval ? 'SPY approval' : 'position';
    const reasonExplanation = reason ? CONTRACT_REASON_EXPLANATIONS[reason] : undefined;
    return {
      title: wrapping
        ? 'ETH wrapping reverted.'
        : wethApproval
          ? 'WETH approval reverted.'
          : approval
            ? 'SPY approval reverted.'
            : 'Open position reverted.',
      explanation: reason
        ? `${reasonExplanation ?? `The contract rejected the ${action}.`} Contract reason: ${reason}. No position was opened.`
        : `The contract rejected the ${action}. No position was opened. Check the technical details below and try again.`,
      technicalDetails,
      code: details.code,
      stage,
    };
  }

  if (stage === 'switching') {
    return {
      title: 'Could not switch network.',
      explanation: 'The wallet could not switch to Robinhood Testnet. Check the wallet network and try again.',
      technicalDetails,
      code: details.code,
      stage,
    };
  }

  const primary = details.messages[0];
  return {
    title: stage === 'connecting' ? 'Could not connect the wallet.' : 'Could not open the position.',
    explanation: primary
      ? `No transaction was completed. The wallet or network reported: ${primary}`
      : 'No transaction was completed. Check your wallet and network connection, then try again.',
    technicalDetails,
    code: details.code,
    stage,
  };
}
