import Link from 'next/link';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <nav className="site-footer__nav" aria-label="Footer">
          <Link href="/">Home</Link>
          <Link href="/open">Open position</Link>
          <Link href="/position">Manage</Link>
          <Link href="/stability">Stability pool</Link>
        </nav>

        <p className="site-footer__legal">
          FLORIN © 2026<br />SPY $600.00 — ORACLE MOCK
        </p>

        <Link href="/" className="site-footer__brand" aria-label="Florin home">
          <span className="site-footer__mark" aria-hidden="true" />
          <span>Florin</span>
        </Link>
      </div>
    </footer>
  );
}
