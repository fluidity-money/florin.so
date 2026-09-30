'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAppKit, useAppKitNetworkCore } from '@reown/appkit/react';
import { useWallet } from './wallet/wallet';
import { Button } from './ui';
import { captureEvent } from '../lib/analytics';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/open', label: 'Open position' },
  { href: '/stability', label: 'Earn' },
  { href: '/position', label: 'Manage' },
];

// Network selector. Only mounted when the real (Reown) provider is active, so
// the AppKit hooks are safe to call. Opens the network-sheet; shows the active
// chain name once one is set.
function NetworkControl() {
  const { open } = useAppKit();
  const { caipNetwork } = useAppKitNetworkCore();
  const net = caipNetwork?.name ?? 'Connect network';
  return (
    <Button
      variant="ghost"
      onClick={() => {
        captureEvent('network_selector_opened', { current_chain: net });
        void open({ view: 'Networks' });
      }}
    >
      {net}
    </Button>
  );
}

export function Header() {
  const w = useWallet();
  const path = usePathname();
  const [walletError, setWalletError] = useState(false);

  async function toggleWallet() {
    setWalletError(false);
    if (w.connected) {
      try {
        await w.disconnect();
        captureEvent('wallet_disconnected', { source: 'header', route: path, wallet_kind: w.kind });
      } catch {
        setWalletError(true);
      }
      return;
    }

    captureEvent('wallet_connection_requested', { source: 'header', route: path, wallet_kind: w.kind });
    try {
      await w.connect();
      captureEvent('wallet_connection_succeeded', { source: 'header', route: path, wallet_kind: w.kind });
    } catch {
      setWalletError(true);
      captureEvent('wallet_connection_failed', { source: 'header', route: path, wallet_kind: w.kind });
    }
  }

  return (
    <header className="site-header">
      <div className="site-header__row">
        <Link href="/" className="brand" aria-label="Florin home">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">Florin</span>
        </Link>

        <nav className="site-nav" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={path === n.href ? 'site-nav__link site-nav__link--active' : 'site-nav__link'}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="site-header__conn">
          {w.connected && w.short && <span className="addr-chip">{w.short}</span>}
          {walletError && <span className="addr-chip">Wallet unavailable</span>}
          {w.kind === 'reown' && <NetworkControl />}
          <Button
            variant={w.connected ? 'ghost' : 'primary'}
            onClick={() => void toggleWallet()}
          >
            {w.connected ? 'Disconnect' : 'Connect wallet'}
          </Button>
          {w.mock && !w.connected}
        </div>
      </div>
    </header>
  );
}