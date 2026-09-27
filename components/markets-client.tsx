'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isFlorinMarkets, hasMarketData, type FlorinMarkets } from '../lib/florin-markets';
import { Table } from './ui';
import { Token } from './token-icon';

const STORAGE_KEY = 'florin:markets:v1';

function Collateral({ name }: { name: string }) {
  if (name === 'SPY' || name === 'FUSD') {
    return <Token symbol={name} size={20} className="market__asset" />;
  }
  return <span className="market__asset">{name}</span>;
}

const unavailableRow = [
  <span className="mono" key="asset">—</span>,
  <span className="mono" key="rate">—</span>,
  <span className="mono" key="amount">—</span>,
  <span className="mono" key="coverage">—</span>,
  null,
];

export function MarketsClient({ initialData }: { initialData: FlorinMarkets }) {
  const [markets, setMarkets] = useState(initialData);

  useEffect(() => {
    let cancelled = false;

    // Preserve useful server data immediately. If the server had no data, use
    // the browser's last successful result while the fresh request is in flight.
    try {
      if (hasMarketData(initialData)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isFlorinMarkets(parsed)) setMarkets(parsed);
        }
      }
    } catch {
      // Storage can be disabled or full; live refresh should still proceed.
    }

    async function refresh() {
      try {
        const response = await fetch('/api/florin-markets', { cache: 'no-store' });
        if (!response.ok) throw new Error(`market refresh returned HTTP ${response.status}`);

        const latest: unknown = await response.json();
        if (!isFlorinMarkets(latest)) throw new Error('market refresh returned invalid data');
        if (cancelled) return;

        setMarkets(latest);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
        } catch {
          // Rendering fresh data does not depend on storage being available.
        }
      } catch (error) {
        console.error('Unable to refresh Florin market data:', error);
      }
    }

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  const borrowRows = markets.borrowDetails.map((details) => [
    <Collateral name={details.collateral.name} key="asset" />,
    <span className="mono" key="rate">{details.avgRatePa}</span>,
    <span className="mono" key="deposited">{details.deposited}</span>,
    <span className="mono" key="debt">{details.debtIssued}</span>,
    <Link className="market__cta" href="/open" key="action">Borrow →</Link>,
  ]);

  const earnRows = markets.earnRewards.map((rewards) => [
    <Collateral name={rewards.collateral.name} key="asset" />,
    <span className="mono" key="apr">{rewards.apr}</span>,
    <span className="mono" key="pool">{rewards.poolSize}</span>,
    <span className="mono" key="coverage">{rewards.coverage}</span>,
    <Link className="market__cta" href="/stability" key="action">Earn →</Link>,
  ]);

  return (
    <div className="grid grid-cols-2 markets">
      <section className="market">
        <h2 className="market__title">Borrow FUSD against tokenized equities</h2>
        <p className="market__sub">
          You can adjust your loan, including your interest rate, at any time
        </p>

        <Table
          head={['Collateral', 'Avg rate, p.a.', 'Deposited', 'Debt issued', '']}
          rows={borrowRows.length > 0 ? borrowRows : [unavailableRow]}
        />
      </section>

      <section className="market">
        <h2 className="market__title">Earn rewards with FUSD</h2>
        <p className="market__sub">
          Earn borrower interest and seized SPY by putting your FUSD in a
          stability pool
        </p>

        <Table
          head={['Pool', 'APR', 'Pool size', 'Coverage', '']}
          rows={earnRows.length > 0 ? earnRows : [unavailableRow]}
        />
      </section>
    </div>
  );
}
