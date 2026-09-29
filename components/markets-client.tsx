'use client';

import Link from 'next/link';
import type { FlorinMarkets } from '../lib/florin-markets';
import { useFlorinMarkets } from '../lib/use-florin-markets';
import { Table } from './ui';
import { Token } from './token-icon';


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
  const markets = useFlorinMarkets(initialData);

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
