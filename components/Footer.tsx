'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSpyPrice } from '../lib/use-spy-price';
import { money } from '../lib/format';

// Inline rather than a file in /public so the glyph inherits `currentColor`
// and picks up the link's hover state without a second copy of the asset.
function XLogo() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  const path = usePathname();
  const { price, live } = useSpyPrice();

  // Landing page only. On the app pages the footer nav duplicates the header
  // and the black block adds a third of a screen of scroll to reach it.
  if (path !== '/') return null;

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <nav className="site-footer__nav" aria-label="Footer">
          <Link href="/">Home</Link>
          <Link href="/open">Open position</Link>
          <Link href="/stability">Earn</Link>
          <Link href="/position">Manage</Link>
        </nav>

        <div className="site-footer__centre">
          <p className="site-footer__legal">
            FLORIN © 2026
            <br />
            SPY {live ? `$${money(price)}` : '—'} · {live ? 'ONCHAIN' : 'UNAVAILABLE'}
          </p>

          <a
            className="site-footer__social"
            href="https://x.com/FlorinProtocol"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Florin on X"
          >
            <XLogo />
          </a>
        </div>

        <Link href="/" className="site-footer__brand" aria-label="Florin home">
          <span className="site-footer__mark" aria-hidden="true" />
          <span>Florin</span>
        </Link>
      </div>
    </footer>
  );
}
