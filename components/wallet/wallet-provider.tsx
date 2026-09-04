'use client';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppKitProvider,
  useAppKitAccount,
  useAppKit,
  useDisconnect,
} from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { robinhood } from '@reown/appkit/networks';
import { Wallet, WalletContext, MOCK_ADDRESS } from './wallet';

/*
 * Wallet bridge.
 *
 * Two modes:
 *   - REAL  : Reown AppKit + wagmi adapter (injected wallets, WC QR, network
 *             switching). Enabled when NEXT_PUBLIC_REOWN_PROJECT_ID is a real
 *             project id. This is the "full wallet" — the only REAL part.
 *   - MOCK  : offline fallback with a fixed demo address so the whole UI stays
 *             clickable even without a Reown Cloud project id.
 *
 * Flip modes by setting .env.local -> NEXT_PUBLIC_REOWN_PROJECT_ID.
 */

const PROJECT_ID = (process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? '').trim();
const HAS_REAL =
  PROJECT_ID.length > 0 &&
  PROJECT_ID !== 'YOUR_REOWN_PROJECT_ID' &&
  PROJECT_ID !== 'REPLACE_ME' &&
  PROJECT_ID !== 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

// --- Mock mode ---------------------------------------------------------------
function MockWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const wallet: Wallet = {
    connected: address !== null,
    address,
    short: address ? shortAddr(address) : null,
    kind: 'mock',
    mock: true,
    connect() {
      setAddress(MOCK_ADDRESS);
    },
    disconnect() {
      setAddress(null);
    },
  };
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

// --- Real mode ---------------------------------------------------------------
function RealWalletBridge({ children }: { children: ReactNode }) {
  const acc = useAppKitAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const wallet: Wallet = {
    connected: acc.isConnected,
    address: acc.address ?? null,
    short: acc.address ? shortAddr(acc.address) : null,
    kind: 'real',
    mock: false,
    connect: () => void open({ view: 'Networks' }),
    disconnect: () => void disconnect(),
  };
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

function RealWalletProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo(
    () => new WagmiAdapter({ projectId: PROJECT_ID, networks: [robinhood] }),
    []
  );
  // Don't block/nag on wrong network — the user picks their chain on demand
  // via the header "Connect network" button.
  return (
    <AppKitProvider
      projectId={PROJECT_ID}
      adapters={[adapter]}
      networks={[robinhood]}
      defaultNetwork={robinhood}
      allowUnsupportedChain={true}
      themeMode="light"
      metadata={{
        name: 'Florin',
        description: 'Mint FUSD by borrowing SPY',
        url: 'http://localhost:3000',
        icons: [],
      }}
    >
      <RealWalletBridge>{children}</RealWalletBridge>
    </AppKitProvider>
  );
}

// --- Entry -------------------------------------------------------------------
export function WalletProvider({ children }: { children: ReactNode }) {
  if (HAS_REAL) return <RealWalletProvider>{children}</RealWalletProvider>;
  return <MockWalletProvider>{children}</MockWalletProvider>;
}