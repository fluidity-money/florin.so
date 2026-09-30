'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAppKit, useAppKitNetworkCore } from '@reown/appkit/react';
import { robinhoodTestnet } from '@reown/appkit/networks';
import { useWallet } from './wallet/wallet';
import { Button } from './ui';
import { captureEvent } from '../lib/analytics';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/open', label: 'Open position' },
  { href: '/stability', label: 'Earn' },
  { href: '/position', label: 'Manage' },
];

// Address and network in one control, because they answer the same question:
// which account am I acting as, and on what. Three separate pills spent the
// whole right-hand side of the header on a chain name that is the same on
// every visit.
//
// Quiet when correct: a dot and the truncated address, with the full chain
// name on hover. Loud when not: the pill turns red and says so, which is the
// only moment the network is worth a reader's attention. Clicking opens the
// network sheet either way.
//
// Only mounted when the real (Reown) provider is active, so the AppKit hooks
// are safe to call.
function ReownAccountControl({ short }: { short: string }) {
  const { open } = useAppKit();
  const { caipNetwork } = useAppKitNetworkCore();

  const net = caipNetwork?.name ?? null;
  // No network yet reads as wrong rather than right: better to prompt than to
  // imply a connection that is not there.
  const onExpected = caipNetwork?.id === robinhoodTestnet.id;

  return (
    <button
      type="button"
      className={onExpected ? 'account-pill' : 'account-pill account-pill--wrong'}
      title={net ? `Connected to ${net}` : 'No network selected'}
      onClick={() => {
        captureEvent('network_selector_opened', { current_chain: net ?? 'none' });
        void open({ view: 'Networks' });
      }}
    >
      <span className="account-pill__dot" aria-hidden="true" />
      <span className="account-pill__text">{onExpected ? short : 'Wrong network'}</span>
    </button>
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
          {w.connected && w.short &&
            (w.kind === 'reown'
              ? <ReownAccountControl short={w.short} />
              : /* Injected wallets have no network sheet to open, so the
                   address stays a plain chip rather than a dead button. */
                <span className="addr-chip">{w.short}</span>)}
          {walletError && <span className="addr-chip">Wallet unavailable</span>}
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