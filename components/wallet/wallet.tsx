'use client';
import { createContext, useContext } from 'react';

// WalMocked demo address used when no real Reown project id is configured.
export const MOCK_ADDRESS = '0xF1Or1n51DeADbeef0000000000005C0FFEE';

export type WalletKind = 'real' | 'mock' | 'none';

export interface Wallet {
  connected: boolean;
  address: string | null;
  short: string | null;
  kind: WalletKind;
  mock: boolean;
  connect(): void;
  disconnect(): void;
}

export const NULL_WALLET: Wallet = {
  connected: false,
  address: null,
  short: null,
  kind: 'none',
  mock: false,
  connect() {},
  disconnect() {},
};

export const WalletContext = createContext<Wallet | null>(null);

export function useWallet(): Wallet {
  const w = useContext(WalletContext);
  return w ?? NULL_WALLET;
}