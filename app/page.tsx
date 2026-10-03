import Link from 'next/link';
import { Hero } from '../components/hero';
import { Markets } from '../components/markets';
import { RisksDialog } from '../components/risks-dialog';
import { fetchFlorinMarkets } from '../lib/florin-graph';

const testnetStats = [
  { label: 'Faucet users', value: 500 },
  { label: 'Unique wallets', value: 800 },
];

const largestTestnetStat = Math.max(...testnetStats.map(({ value }) => value));

export default async function HomePage() {
  const markets = await fetchFlorinMarkets();
  return (
    <div className="home home--hero">
      <Hero markets={markets} />

      <div className="home-action-grid">
        <Link href="/open" className="card home-action">
          <span className="card__row">
            <span className="card__title">Borrow</span>
            <span className="card__arrow">→</span>
          </span>
          <span className="card__body">
            Mint FUSD against your collateral at whatever interest rate you want
          </span>
        </Link>

        <Link href="/stability" className="card home-action">
          <span className="card__row">
            <span className="card__title">Earn with FUSD</span>
            <span className="card__arrow">→</span>
          </span>
          <span className="card__body">
            Deposit FUSD to earn protocol revenues and liquidation proceeds
          </span>
        </Link>

        <div className="card home-action home-action--soon" aria-disabled="true">
          <span className="card__row">
            <span className="card__title">Multiply</span>
            <span className="card__soon">coming soon</span>
          </span>
          <span className="card__body">
            Increase your exposure to tokenized equities and their dividends with
            a single click
          </span>
        </div>
      </div>

      <Markets initialData={markets} />

      <RisksDialog label="Before you borrow, read what can go wrong" />

      <section className="testnet-stats" aria-labelledby="testnet-stats-title">
        <div className="testnet-stats__head">
          <p className="overline">Network activity</p>
          <h2 id="testnet-stats-title">Testnet Stats</h2>
        </div>
        <div className="testnet-stats__chart">
          {testnetStats.map(({ label, value }) => (
            <div className="testnet-stats__row" key={label}>
              <div className="testnet-stats__label">
                <span>{label}</span>
                <strong>{value.toLocaleString('en-US')}</strong>
              </div>
              <div
                className="testnet-stats__track"
                role="meter"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={largestTestnetStat}
                aria-valuenow={value}
              >
                <span
                  className="testnet-stats__bar"
                  style={{ width: `${(value / largestTestnetStat) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
