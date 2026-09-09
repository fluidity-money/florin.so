"""End-to-end scenario. Run with `python3 -m florin.demo`.

Walks the full lifecycle: four borrowers at different rates, a Stability Pool
funded by one of them, a year of interest, a dividend firing for the first
time, a redemption defending the peg, a crash that liquidates someone, and
finally the issuer pausing the collateral.

Invariants are checked after every act.
"""

from __future__ import annotations

from decimal import Decimal as D

from .collateral import PriceFeed, StockToken, pay_dividend
from .protocol import PROTOCOL, TREASURY, Florin, ProtocolError

YEAR = 365 * 24 * 3600


def rule(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m\n" + "-" * 66)


def show_troves(f: Florin, wall: int) -> None:
    now, price = f.clock.now(wall), f.price()
    print(f"  {'owner':<8}{'rate':>7}{'collateral':>13}{'debt':>11}{'CR':>9}{'liq px':>10}")
    for owner in sorted(f.troves, key=lambda o: f.troves[o].rate):
        t = f.troves[owner]
        cr = f.market.collateral_ratio(t, price, now)
        lp = f.market.liquidation_price(t, now)
        flag = "" if cr >= f.market.params.mcr else "  <-- underwater"
        print(
            f"  {owner:<8}{t.rate:>6.1%}{t.collateral:>13.4f}"
            f"{f.market.debt_at(t, now):>11.2f}{cr:>9.1%}{lp:>10.2f}{flag}"
        )
    print(f"  {'':<8}{'':>7}{'':>13}{'':>11}{'TCR':>9}{f.total_collateral_ratio():>9.1%}")


def main() -> None:
    token = StockToken(symbol="SPY")
    feed = PriceFeed(token, share_price=D("650"))
    f = Florin(token=token, feed=feed)

    for who, amount in [("alice", "8"), ("bob", "6"), ("carol", "7"), ("dave", "10")]:
        token.mint(who, D(amount))

    # ---------------------------------------------------------------- act 1
    rule("1. Four borrowers open troves, each picking their own rate")
    f.open_trove("alice", collateral=D("6"), borrow=D("2400"), rate=D("0.04"), wall=0)
    f.open_trove("bob", collateral=D("4"), borrow=D("1500"), rate=D("0.07"), wall=0)
    f.open_trove("carol", collateral=D("5"), borrow=D("2000"), rate=D("0.10"), wall=0)
    f.open_trove("dave", collateral=D("8"), borrow=D("3000"), rate=D("0.08"), wall=0)
    show_troves(f, 0)
    print(f"\n  SPY ${feed.latest():.2f}/token   multiplier {token.ui_multiplier:.6f}")
    print("  alice is cheapest, so she is first in the redemption queue.")
    f.check_invariants()

    # ---------------------------------------------------------------- act 2
    rule("2. Dave puts his borrowed FUSD into the Stability Pool")
    f.deposit_pool("dave", D("3000"), wall=0)
    print(f"  pool holds {f.pool.total:,.2f} FUSD")
    print(f"  coverage   {f.pool.coverage(f.total_debt):.1%} of system debt")
    print("  A thin pool pays a high yield precisely because it is thin.")
    f.check_invariants()

    # ---------------------------------------------------------------- act 3
    rule("3. One year passes. Interest accrues to debt, never to collateral")
    interest = f.accrue_all(YEAR)
    print(f"  interest accrued  {interest:>10,.2f} FUSD")
    print(f"  to Stability Pool {interest * f.sp_interest_share:>10,.2f}  (75%)")
    print(f"  to treasury       {interest * (1 - f.sp_interest_share):>10,.2f}")
    print(f"\n  dave's pool deposit is now {f.pool.deposit_of('dave'):,.2f} FUSD")
    show_troves(f, YEAR)
    f.check_invariants()

    # ---------------------------------------------------------------- act 4
    rule("4. The first ex-dividend date. The multiplier fires for the first time")
    before_price, before_mult = feed.latest(), token.ui_multiplier
    pay_dividend(feed, per_share=D("2.00"), withholding=D("0.30"))
    print(f"  share price   ${before_price:.2f}  ->  ${feed.share_price:.2f}   (drops by the dividend)")
    print(f"  multiplier     {before_mult:.6f}  ->  {token.ui_multiplier:.6f}   (reinvested)")
    print(f"  token price   ${before_price:.2f}  ->  ${feed.latest():.4f}")
    print(f"\n  Holder is out ${before_price - feed.latest():.4f}/token, which is exactly")
    print("  the 30% withheld. With no withholding the token price is unchanged.")
    print("  Note collateral value moved without any raw balance moving.")
    f.check_invariants()

    # ---------------------------------------------------------------- act 5
    rule("5. FUSD slips below a dollar. An arbitrageur redeems")
    # The arb buys existing FUSD on a DEX rather than conjuring it. Supply is
    # only ever created against trove debt, which check_invariants enforces.
    f._debit("alice", D("900"))
    f._credit("arb", D("900"))
    result = f.redeem("arb", D("900"), YEAR)
    print(f"  burned          {result['burned']:>10,.2f} FUSD")
    print(f"  collateral out  {result['collateral_out']:>10.4f} SPY")
    print(f"  fee kept        {result['fee']:>10.4f} SPY")
    print(f"  troves hit      {', '.join(result['troves_hit'])}")
    print("\n  Alice was hit because she bid the lowest rate. Her ratio improved:")
    show_troves(f, YEAR)
    f.check_invariants()

    # ---------------------------------------------------------------- act 6
    rule("6. The market falls 13%")
    feed.move(D("-0.13"))
    print(f"  SPY now ${feed.latest():.2f}/token\n")
    show_troves(f, YEAR)

    liquidations = f.liquidate_all(YEAR)
    print()
    for liq in liquidations:
        print(
            f"  liquidated {liq['owner']:<7} debt {liq['debt']:>9,.2f} at CR {liq['cr']:.1%}"
            f"   offset {liq['offset']:>9,.2f}   redistributed {liq['redistributed']:>8,.2f}"
        )
    print(f"\n  dave's deposit fell to {f.pool.deposit_of('dave'):,.2f} FUSD")
    print(f"  but he won {f.pool.gain_of('dave'):.4f} SPY "
          f"(${f.pool.gain_of('dave') * f.price():,.2f}) at a discount")
    print(f"  bad debt: {f.bad_debt:,.2f}")
    show_troves(f, YEAR)
    f.check_invariants()

    # ---------------------------------------------------------------- act 7
    rule("7. The issuer pauses the token mid-crisis")
    f.pause(YEAR)
    print("  Robinhood called pause(). Florin freezes with it:")
    for label, call in [
        ("liquidate", lambda: f.liquidate_all(YEAR)),
        ("redeem", lambda: f.redeem("arb", D("10"), YEAR)),
        ("claim pool gains", lambda: f.claim_pool_gains("dave")),
    ]:
        try:
            call()
            print(f"    {label:<18} went through  <-- should not happen")
        except ProtocolError as exc:
            print(f"    {label:<18} refused: {exc}")

    survivor = next(iter(f.troves))
    debt_at_pause = f.market.debt_at(f.troves[survivor], f.clock.now(YEAR))
    later = YEAR + 90 * 24 * 3600
    debt_later = f.market.debt_at(f.troves[survivor], f.clock.now(later))
    print(f"\n  Ninety days pass while frozen.")
    print(f"    {survivor}'s debt at pause  {debt_at_pause:,.2f}")
    print(f"    {survivor}'s debt 90d later {debt_later:,.2f}   (clock stopped)")
    print("  Borrowers are not charged for a freeze they cannot escape.")

    f.unpause(later)
    resumed = f.market.debt_at(f.troves[survivor], f.clock.now(later + 30 * 24 * 3600))
    print(f"\n  Unpaused. Thirty days later: {resumed:,.2f}   (accruing again)")
    f.check_invariants()

    # ---------------------------------------------------------------- done
    rule("Final state")
    show_troves(f, later)
    print(f"\n  FUSD supply     {f.fusd_supply:>12,.2f}")
    print(f"  total debt      {f.total_debt:>12,.2f}   (equal, by invariant)")
    print(f"  treasury        {f.treasury:>12,.2f}")
    print(f"  pool            {f.pool.total:>12,.2f}")
    print(f"  bad debt        {f.bad_debt:>12,.2f}")
    f.check_invariants()
    print("\n  all invariants hold")


if __name__ == "__main__":
    main()
