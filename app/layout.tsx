import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '../components/Providers';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { CookieConsent } from '../components/CookieConsent';
import { themeVars } from '../lib/theme';

export const metadata: Metadata = {
  metadataBase: new URL('https://florin.so'),
  title: 'Florin',
  description: 'Borrow USD using SPY on Robinhood',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Florin',
    title: 'Florin — Never sell a share.',
    description: 'Deposit SPY, mint FUSD, and borrow dollars without giving up your position.',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Florin — Never sell a share.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@florinprotocol',
    creator: '@florinprotocol',
    title: 'Florin — Never sell a share.',
    description: 'Deposit SPY, mint FUSD, and borrow dollars without giving up your position.',
    images: ['/opengraph-image.jpg'],
  },
};

// Light defaults and fonts on <html>; CSS owns the adaptive semantic tokens.
const style = themeVars() as React.CSSProperties;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" style={style}>
      <body>
        <Providers>
          <a
            className="testnet-banner"
            href="https://x.com/FlorinProtocol/status/2119747363401015747"
            target="_blank"
            rel="noopener noreferrer"
          >
            Florin Testnet V2 has started! All positions have been reset.{' '} All users
            have received 100 SPY. <span className="testnet-banner__link">Click here to
            learn more</span>
          </a>
          <Header />
          <main className="main">{children}</main>
          <Footer />
        </Providers>
        <CookieConsent />
      </body>
    </html>
  );
}