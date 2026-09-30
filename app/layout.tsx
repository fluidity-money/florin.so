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

// Theme tokens (colors + fonts) from lib/theme.ts, applied as CSS variables on <body>.
const style = themeVars() as React.CSSProperties;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body style={style}>
        <Providers>
          <Header />
          <main className="main">{children}</main>
          <Footer />
        </Providers>
        <CookieConsent />
      </body>
    </html>
  );
}