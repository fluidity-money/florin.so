import { FLORIN_GRAPH_URL } from './florin-market-query';

export const ACCOUNTS_GRAPH_URL =
  process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.superposition.so';

interface GraphResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function graphRequest<T>(
  url: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`GraphQL returned HTTP ${response.status}`);

  const result = (await response.json()) as GraphResponse<T>;
  if (result.errors?.length) {
    throw new Error(result.errors.map(({ message }) => message).join('; '));
  }
  if (!result.data) throw new Error('GraphQL returned no data');
  return result.data;
}

export interface FlorinPermitInput {
  deadline: number;
  permitV: number;
  permitR: string;
  permitS: string;
}

export interface FlorinOpenPositionInput {
  owner: string;
  asset: 'USDG' | 'SPY';
  collateralAmt: string;
  boldAmt: string;
  annualInterestRate: string;
  ownerIndex: string;
  maxUpfrontFee: string;
  lowerHint: string;
  upperHint: string;
  addManager?: string;
  removeManager?: string;
  receiver: string;
  permit?: FlorinPermitInput;
}

export interface CreateAccountFlorinOpenPositionInput {
  createAccount: {
    eoa_addr: string;
    sigV: number;
    sigR: string;
    sigS: string;
  };
  openPosition: FlorinOpenPositionInput;
  gasToken: 'USDG' | 'SPY';
  gasTokenAmt: string;
  dryrun?: boolean;
}

export interface CreateAccountFlorinOpenPositionResult {
  hash: string;
  secret: string;
}

export async function requestAccountsPublicKey(): Promise<string> {
  const data = await graphRequest<{ publickey: string }>(
    ACCOUNTS_GRAPH_URL,
    'query PublicKey { publickey }',
  );
  return data.publickey;
}

export async function hasCreatedAccount(address: string): Promise<boolean> {
  const data = await graphRequest<{ hasCreated: boolean }>(
    ACCOUNTS_GRAPH_URL,
    'query HasCreated($address: String!) { hasCreated(address: $address) }',
    { address },
  );
  return data.hasCreated;
}

export async function requestAccountSecret(input: {
  eoaAddr: string;
  nonce: number;
  sigV: number;
  sigR: string;
  sigS: string;
}): Promise<string> {
  const data = await graphRequest<{ requestSecret: string }>(
    ACCOUNTS_GRAPH_URL,
    `mutation RequestSecret(
      $eoaAddr: String!
      $nonce: Int!
      $sigV: Int!
      $sigR: String!
      $sigS: String!
    ) {
      requestSecret(
        eoa_addr: $eoaAddr
        nonce: $nonce
        sigV: $sigV
        sigR: $sigR
        sigS: $sigS
      )
    }`,
    input,
  );
  return data.requestSecret;
}

export async function createAccountFlorinOpenPosition(
  input: CreateAccountFlorinOpenPositionInput,
): Promise<CreateAccountFlorinOpenPositionResult> {
  const data = await graphRequest<{
    createAccountFlorinOpenPosition: CreateAccountFlorinOpenPositionResult | null;
  }>(
    FLORIN_GRAPH_URL,
    `mutation CreateAccountFlorinOpenPosition(
      $createAccount: CreateAccount!
      $openPosition: FlorinOpenPosition!
      $gasToken: Asset!
      $gasTokenAmt: String!
      $dryrun: Boolean
    ) {
      createAccountFlorinOpenPosition(
        createAccount: $createAccount
        openPosition: $openPosition
        gasToken: $gasToken
        gasTokenAmt: $gasTokenAmt
        dryrun: $dryrun
      ) {
        hash
        secret
      }
    }`,
    { ...input },
  );
  if (!data.createAccountFlorinOpenPosition) {
    throw new Error('Florin account creation returned no result');
  }
  return data.createAccountFlorinOpenPosition;
}
