'use client';

import Link from 'next/link';
import { Table } from './ui';
import {
  AVG_RATE,
  DEBT_CAP_FUSD,
  PROTOCOL_STATS,
  collateralValueUSD,
  stabilityPoolApr,
} from '../lib/mockData';
import { compact, pct } from '../lib/format';
import { useSpyPrice } from '../lib/use-spy-price';

// The two market tables. One row each for now, because SPY is the only
// collateral and therefore the only pool, but both are tables rather than
// panels so adding the second asset is a data change and not a layout one.
export function Markets() {
  const { price } = useSpyPrice();

  const collateralUsd = collateralValueUSD(PROTOCOL_STATS.spyLocked, price);
  const apr = stabilityPoolApr();

  return (
    <div className="grid grid-cols-2 markets">
      <section className="market">
        <h2 className="market__title">Borrow FUSD against tokenized equities</h2>
        <p className="market__sub">
          You can adjust your loan, including your interest rate, at any time
        </p>

        <Table
          head={['Collateral', 'Avg rate, p.a.', 'Deposited', 'Debt issued', '']}
          rows={[
            [
              <span className="market__asset" key="a">
                <span className="market__mark" aria-hidden="true" />
                SPY
              </span>,
              <span className="mono" key="r">
                {pct(AVG_RATE * 100, 2)}
              </span>,
              <span className="mono" key="d">
                {compact(collateralUsd)}
              </span>,
              <span className="mono" key="i">
                {compact(PROTOCOL_STATS.totalDebtUsd)} / {compact(DEBT_CAP_FUSD)}
              </span>,
              <Link className="market__cta" href="/open" key="c">
                Borrow →
              </Link>,
            ],
          ]}
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
          rows={[
            [
              <span className="market__asset" key="a">
                <span className="market__mark" aria-hidden="true" />
                SPY
              </span>,
              <span className="mono" key="r">
                {apr > 0 ? pct(apr * 100, 2) : 'n/a'}
              </span>,
              <span className="mono" key="s">
                {compact(PROTOCOL_STATS.stabilityPoolUsd)}
              </span>,
              <span className="mono" key="c">
                {pct(
                  (PROTOCOL_STATS.stabilityPoolUsd / PROTOCOL_STATS.totalDebtUsd) * 100,
                  0,
                )}
              </span>,
              <Link className="market__cta" href="/stability" key="e">
                Earn →
              </Link>,
            ],
          ]}
        />
      </section>
    </div>
  );
}
