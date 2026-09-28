'use client';
import { createContext, useContext } from 'react';
import type { EIP1193Provider } from 'viem';

export type WalletKind = 'reown' | 'injected' | 'none';

export interface Wallet {
  connected: boolean;
  address: string | null;
  short: string | null;
  kind: WalletKind;
  mock: boolean;
  provider: EIP1193Provider | null;
  connect(): void | Promise<void>;
  disconnect(): void | Promise<void>;
}

export const NULL_WALLET: Wallet = {
  connected: false,
  address: null,
  short: null,
  kind: 'none',
  mock: false,
  provider: null,
  connect() {},
  disconnect() {},
};

export const WalletContext = createContext<Wallet | null>(null);

export function useWallet(): Wallet {
  const w = useContext(WalletContext);
  return w ?? NULL_WALLET;
}