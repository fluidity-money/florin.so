'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from './wallet/wallet';
import { Button } from './ui';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/open', label: 'Open position' },
  { href: '/position', label: 'Manage' },
  { href: '/stability', label: 'Stability pool' },
];

export function Header() {
  const w = useWallet();
  const path = usePathname();

  return (
    <header className="site-header">
      <div className="site-header__row">
        <Link href="/" className="brand">
          <span className="brand__mark">¤</span>
          <span className="brand__name">
            florin <span className="brand__sub">/ stable SPY</span>
          </span>
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
          <Button
            variant={w.connected ? 'ghost' : 'primary'}
            onClick={() => (w.connected ? w.disconnect() : w.connect())}
          >
            {w.connected ? 'Disconnect' : 'Connect wallet'}
          </Button>
          {w.mock && !w.connected && <span className="demo-badge">demo wallet</span>}
        </div>
      </div>
    </header>
  );
}