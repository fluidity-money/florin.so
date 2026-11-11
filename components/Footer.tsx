'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSpyPrice } from '../lib/use-spy-price';
import { money } from '../lib/format';
import { setThemeMode, useThemeMode } from '../lib/theme-mode';
import { RisksDialog } from './risks-dialog';
import { TokenIcon } from './token-icon';

// Inline rather than a file in /public so the glyph inherits `currentColor`
// and picks up the link's hover state without a second copy of the asset.
function XLogo() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// One FUSD redeems for a dollar of collateral. Shown until FUSD has a market.
const FUSD_REDEMPTION_USD = 1;

// Which build this is, as version and short commit. The commit links to the
// change on GitHub, so anyone can see exactly what is deployed.
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;
const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA;

function VersionStamp() {
  if (!APP_VERSION) return null;
  if (!COMMIT_SHA) return <span className="site-footer__version">v{APP_VERSION}</span>;
  return (
    <a
      className="site-footer__version"
      href={`https://github.com/fluidity-money/florin.so/commit/${COMMIT_SHA}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Version ${APP_VERSION}, commit ${COMMIT_SHA}`}
    >
      v{APP_VERSION}-{COMMIT_SHA}
    </a>
  );
}

// Day and night. The thumb's position is drawn from <html data-theme> in CSS,
// so it is already on the right side before this component hydrates.
function ThemeSwitch() {
  const dark = useThemeMode() === 'dark';
  return (
    <button
      type="button"
      role="switch"
      className="theme-switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={() => setThemeMode(dark ? 'light' : 'dark')}
    >
      <span className="theme-switch__thumb" aria-hidden="true" />
      <svg className="theme-switch__icon theme-switch__icon--sun" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
      </svg>
      <svg className="theme-switch__icon theme-switch__icon--moon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}

export function Footer() {
  const path = usePathname();
  const { price, live } = useSpyPrice();

  // Landing page only. On the app pages the footer nav duplicates the header.
  if (path !== '/') return null;

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__start">
          <a
            className="site-footer__social"
            href="https://x.com/FlorinProtocol"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Florin on X"
          >
            <XLogo />
          </a>
          <nav className="site-footer__nav" aria-label="Footer">
            <Link href="/">Home</Link>
            <Link href="/open">Borrow</Link>
            <Link href="/multiply">Multiply</Link>
            <Link href="/stability">Earn</Link>
            <Link href="/position">Manage</Link>
            <RisksDialog variant="link" label="Risks" />
          </nav>
        </div>

        <div className="site-footer__prices">
          <span
            className="site-footer__price"
            title={live ? 'SPY oracle price · ONCHAIN' : 'SPY oracle price · UNAVAILABLE'}
          >
            <TokenIcon symbol="SPY" size={18} />
            SPY
            <strong>{live ? `$${money(price)}` : '—'}</strong>
          </span>
          {/* FUSD has no market yet, so this is what the protocol redeems it
              for, not a traded price. */}
          <span className="site-footer__price" title="FUSD redemption value">
            <TokenIcon symbol="FUSD" size={18} />
            FUSD
            <strong>${money(FUSD_REDEMPTION_USD)}</strong>
          </span>
        </div>

        <div className="site-footer__controls">
          <VersionStamp />
          <ThemeSwitch />
        </div>
      </div>
    </footer>
  );
}
