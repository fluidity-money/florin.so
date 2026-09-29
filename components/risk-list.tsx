import Link from 'next/link';
import { MIN_COLLATERAL_RATIO } from '../lib/protocol-constants';
import { pct } from '../lib/format';

// Single source for the risk copy, rendered inside the dialog that opens
// from the foot of each page.
export function RiskList() {
  return (
    <div className="risk-list">
            <article className="risk">
              <span className="risk__tag">borrowers</span>
              <h2 className="risk__title">Liquidation takes the whole position</h2>
              <p className="risk__body">
                If SPY falls far enough that your collateral ratio touches{' '}
                {pct(MIN_COLLATERAL_RATIO * 100, 0)}, the stability pool repays your
                debt and takes <strong>all</strong> of your collateral, not just the
                part that covers what you owe. The difference is the pool&apos;s
                compensation for absorbing you.
              </p>
              <p className="risk__body">
                You keep the FUSD you borrowed. You lose the equity that was still
                in the position. Watch your liquidation price on the Manage screen,
                and add collateral or repay before it gets close.
              </p>
            </article>
    
            <article className="risk">
              <span className="risk__tag">borrowers</span>
              <h2 className="risk__title">Redemption can cash you out early</h2>
              <p className="risk__body">
                FUSD is worth a dollar because anyone can always swap 1 FUSD for a
                dollar of collateral. Those swaps are filled from the{' '}
                <strong>cheapest troves first</strong>, so the interest rate you
                choose is also your place in the queue.
              </p>
              <p className="risk__body">
                Being redeemed against is not a liquidation and it does not lose you
                money: your debt falls by the same amount your collateral does, so
                your ratio improves. What you lose is exposure. The protocol sold
                some of your SPY for you, at today&apos;s price, and you did not pick
                the timing. Raise your rate to move back in the queue.
              </p>
            </article>
    
            <article className="risk">
              <span className="risk__tag">stability pool</span>
              <h2 className="risk__title">Your FUSD becomes SPY after a crash</h2>
              <p className="risk__body">
                Depositing in the pool is not a savings account. When a position is
                liquidated the pool burns FUSD deposits and hands depositors the
                seized collateral instead. You receive it at a discount, which is
                where the return comes from, but you receive it as{' '}
                <strong>equity, immediately after the price fell</strong>, and you
                do not choose when.
              </p>
              <p className="risk__body">
                A high advertised yield is also a warning. It means the pool is
                small relative to the debt it has to absorb, because the same
                interest is split among fewer depositors.
              </p>
            </article>
    
            <article className="risk">
              <span className="risk__tag">everyone</span>
              <h2 className="risk__title">The collateral can be frozen</h2>
              <p className="risk__body">
                SPY on Robinhood Chain is issued by Robinhood, and the deployed
                token can be paused and can block addresses. Florin cannot override
                that. If transfers are paused, deposits, withdrawals, liquidations,
                redemptions and pool claims all stop until it is lifted.
              </p>
              <p className="risk__body">
                Florin freezes with it deliberately: the interest clock stops, so
                you are not charged for a window you could not act in, and
                repayment stays open so you can still deleverage. But your
                collateral is not yours to move while the issuer says so. That is a
                trust assumption you inherit from the asset, and no amount of
                protocol design removes it.
              </p>
            </article>
          </div>
  );
}
