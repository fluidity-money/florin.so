'use client';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppKitProvider,
  useAppKitAccount,
  useAppKit,
  useAppKitProvider,
  useDisconnect,
} from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { robinhoodTestnet } from '@reown/appkit/networks';
import type { EIP1193Provider } from 'viem';
import { Wallet, WalletContext } from './wallet';

const PROJECT_ID = (process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? '').trim();
const HAS_REOWN =
  PROJECT_ID.length > 0 &&
  PROJECT_ID !== 'YOUR_REOWN_PROJECT_ID' &&
  PROJECT_ID !== 'REPLACE_ME' &&
  PROJECT_ID !== 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

function shortAddr(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

type InjectedWindow = Window & { ethereum?: EIP1193Provider };

// A real injected-wallet fallback keeps local builds functional without a
// WalletConnect project id. It deliberately never invents a connected account.
function InjectedWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);

  useEffect(() => {
    const injected = (window as InjectedWindow).ethereum ?? null;
    setProvider(injected);
    if (!injected) return;

    const setFirstAccount = (accounts: unknown) => {
      const first = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
      setAddress(first);
    };

    void injected.request({ method: 'eth_accounts' }).then(setFirstAccount).catch(() => setAddress(null));
    injected.on?.('accountsChanged', setFirstAccount);
    return () => injected.removeListener?.('accountsChanged', setFirstAccount);
  }, []);

  const wallet: Wallet = {
    connected: address !== null,
    address,
    short: address ? shortAddr(address) : null,
    kind: provider ? 'injected' : 'none',
    mock: false,
    provider,
    async connect() {
      if (!provider) {
        throw new Error('No browser wallet found. Install an injected wallet or configure Reown.');
      }
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const first = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null;
      setAddress(first);
    },
    async disconnect() {
      try {
        await provider?.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Not every injected provider implements EIP-2255. Local state still
        // disconnects this session, while supported wallets revoke permission.
      }
      setAddress(null);
    },
  };

  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

function RealWalletBridge({ children }: { children: ReactNode }) {
  const account = useAppKitAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { walletProvider } = useAppKitProvider<EIP1193Provider>('eip155');
  const wallet: Wallet = {
    connected: account.isConnected,
    address: account.address ?? null,
    short: account.address ? shortAddr(account.address) : null,
    kind: 'reown',
    mock: false,
    provider: walletProvider ?? null,
    connect: () => void open({ view: 'Connect' }),
    disconnect: () => void disconnect(),
  };
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

function RealWalletProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo(
    () => new WagmiAdapter({ projectId: PROJECT_ID, networks: [robinhoodTestnet] }),
    [],
  );

  return (
    <AppKitProvider
      projectId={PROJECT_ID}
      adapters={[adapter]}
      networks={[robinhoodTestnet]}
      defaultNetwork={robinhoodTestnet}
      allowUnsupportedChain={false}
      themeMode="light"
      metadata={{
        name: 'Florin',
        description: 'Mint BOLD by borrowing against SPY',
        url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
        icons: [],
      }}
    >
      <RealWalletBridge>{children}</RealWalletBridge>
    </AppKitProvider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  if (HAS_REOWN) return <RealWalletProvider>{children}</RealWalletProvider>;
  return <InjectedWalletProvider>{children}</InjectedWalletProvider>;
}
