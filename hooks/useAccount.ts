'use client';

import { useCallback } from 'react';
import { robinhoodTestnet } from '@reown/appkit/networks';
import {
  createWalletClient,
  custom,
  parseSignature,
  type Address,
} from 'viem';
import {
  createAccountFlorinOpenPosition as createAccountFlorinOpenPositionGraph,
  hasCreatedAccount,
  requestAccountsPublicKey,
  requestAccountSecret,
  type CreateAccountFlorinOpenPositionInput,
  type FlorinOpenPositionInput,
} from '../lib/account-graph';
import { useWallet } from '../components/wallet/wallet';

const SECRET_KEY = '9lives...cret';
const ZERO_AUTHORITY = '0'.repeat(40);
const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;
const FIVE_MINUTES = 1000 * 60 * 5;

function accountAuthority(): string {
  const authority = process.env.NEXT_PUBLIC_ACCOUNT_AUTHORITY_ADDR || ZERO_AUTHORITY;
  const normalized = authority.replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error('NEXT_PUBLIC_ACCOUNT_AUTHORITY_ADDR must be an Ethereum address');
  }
  return normalized;
}

type SignMessage = (message: string) => Promise<`0x${string}`>;

interface StoredSecret {
  secret: string;
  expireAt: string;
}

function secretKey(address: string): string {
  return `${SECRET_KEY}-${address.toLowerCase()}`;
}

function storeSecret(address: string, secret: string): void {
  window.localStorage.setItem(
    secretKey(address),
    JSON.stringify({
      secret,
      expireAt: new Date(Date.now() + ONE_MONTH - FIVE_MINUTES).toUTCString(),
    } satisfies StoredSecret),
  );
}

function readSecret(address: string): string | null {
  const value = window.localStorage.getItem(secretKey(address));
  if (!value) return null;

  try {
    const stored = JSON.parse(value) as Partial<StoredSecret>;
    if (
      typeof stored.secret !== 'string'
      || typeof stored.expireAt !== 'string'
      || new Date() > new Date(stored.expireAt)
    ) {
      window.localStorage.removeItem(secretKey(address));
      return null;
    }
    return stored.secret;
  } catch {
    window.localStorage.removeItem(secretKey(address));
    return null;
  }
}

function encodeNonceBE(nonce: number): string {
  return nonce.toString(16).padStart(8, '0');
}

async function signCreateAccount(address: string, signMessage: SignMessage) {
  const publicKey = await requestAccountsPublicKey();
  const signature = await signMessage(
    `New Superposition account: ${publicKey}, authority contract: ${accountAuthority()}`,
  );
  const { r, s, v } = parseSignature(signature);
  return {
    eoa_addr: address,
    sigV: Number(v),
    sigR: r,
    sigS: s,
  };
}

export const isCreated = hasCreatedAccount;

export async function getSecret(
  address: string,
  signMessage: SignMessage,
): Promise<string> {
  const publicKey = await requestAccountsPublicKey();
  const nonce = Math.floor(Math.random() * 0x7fffffff);
  const signature = await signMessage(publicKey + encodeNonceBE(nonce));
  const { r, s, v } = parseSignature(signature);
  const secret = await requestAccountSecret({
    eoaAddr: address,
    nonce,
    sigV: Number(v),
    sigR: r.slice(2),
    sigS: s.slice(2),
  });
  if (!secret) throw new Error('Account secret was not returned');
  storeSecret(address, secret);
  return secret;
}

export async function checkAndSetSecret(
  address: string,
  signMessage: SignMessage,
): Promise<string | null> {
  const stored = readSecret(address);
  if (stored) return stored;
  if (!(await hasCreatedAccount(address))) return null;
  return getSecret(address, signMessage);
}

export interface CreateFlorinPositionInput {
  openPosition: FlorinOpenPositionInput;
  gasToken: 'USDG' | 'SPY';
  gasTokenAmt: string;
  dryrun?: boolean;
}

export default function useAccount() {
  const wallet = useWallet();

  const signMessage = useCallback<SignMessage>(async (message) => {
    if (!wallet.address || !wallet.provider) throw new Error('No wallet is connected');
    const client = createWalletClient({
      account: wallet.address as Address,
      chain: robinhoodTestnet,
      transport: custom(wallet.provider),
    });
    return client.signMessage({
      account: wallet.address as Address,
      message,
    });
  }, [wallet.address, wallet.provider]);

  const getSecretForWallet = useCallback(async () => {
    if (!wallet.address) throw new Error('No wallet is connected');
    return getSecret(wallet.address, signMessage);
  }, [signMessage, wallet.address]);

  const requireAccount = useCallback(async () => {
    if (!wallet.address) throw new Error('No wallet is connected');
    const secret = await checkAndSetSecret(wallet.address, signMessage);
    if (!secret) throw new Error('This wallet does not have a Superposition account');
    return { address: wallet.address, secret };
  }, [signMessage, wallet.address]);

  const createAccountFlorinOpenPosition = useCallback(async ({
    openPosition,
    gasToken,
    gasTokenAmt,
    dryrun,
  }: CreateFlorinPositionInput) => {
    if (!wallet.address) throw new Error('No wallet is connected');
    if (await hasCreatedAccount(wallet.address)) {
      throw new Error('This wallet already has a Superposition account');
    }

    const createAccount = await signCreateAccount(wallet.address, signMessage);
    const input: CreateAccountFlorinOpenPositionInput = {
      createAccount,
      openPosition,
      gasToken,
      gasTokenAmt,
      dryrun,
    };
    const result = await createAccountFlorinOpenPositionGraph(input);
    if (!result.secret) throw new Error('Florin account creation returned no secret');
    storeSecret(wallet.address, result.secret);
    return result;
  }, [signMessage, wallet.address]);

  return {
    address: wallet.address,
    isCreated: wallet.address ? () => hasCreatedAccount(wallet.address!) : async () => false,
    getSecret: getSecretForWallet,
    requireAccount,
    createAccountFlorinOpenPosition,
  };
}
