import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from '../components/Providers';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { themeVars } from '../lib/theme';

export const metadata: Metadata = {
  title: 'Florin',
  description: 'Borrow USD using SPY on Robinhood',
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
      </body>
    </html>
  );
}