"""Florin core borrowing mechanics: a reference implementation.

Deliberately not a simulation of the whole protocol. This covers opening,
adjusting and closing a position, interest accrual, and the health metrics
that everything else keys off. Liquidation, redemption and the Stability
Pool are separate concerns and belong in their own modules.

Shape mirrors the eventual Solidity: `Trove` is a dumb record (a struct),
`Market` holds the parameters and all of the logic (a TroveManager).

Conventions
-----------
* Money is `Decimal`, never float. Amounts are in human units, not wei.
* Collateral is a *raw* token balance. See `Market.collateral_value` for the
  one non-obvious rule in this file.
* Rates are annual and expressed as fractions: 0.06 is 6%.
* Time is unix seconds, and every entry point validates it. `Market` is a
  public boundary in its own right, not a trusted internal layer, so it
  guards its own inputs rather than relying on `Florin` to have done it.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from decimal import Decimal
from typing import Iterator

from .guards import finite, non_negative, positive, wall_time

D = Decimal

SECONDS_PER_YEAR = D(365 * 24 * 60 * 60)


class TroveError(Exception):
    """Raised when an operation would leave a trove in an invalid state."""


# --------------------------------------------------------------------------
# state
# --------------------------------------------------------------------------


@dataclass
class Trove:
    """One borrowing position.

    `debt` is the *recorded* debt as of `last_update`. Interest accrued since
    then is not included until `Market.accrue` folds it in, so always read the
    debt through `Market.debt_at` rather than touching this field directly.
    """

    collateral: D  # raw sSPX token balance
    debt: D  # FUSD owed as of last_update
    rate: D  # annual interest rate, chosen by the borrower
    last_update: int  # unix seconds

    def __repr__(self) -> str:
        return (
            f"Trove(collateral={self.collateral:.4f}, debt={self.debt:.2f}, "
            f"rate={self.rate:.2%})"
        )


@dataclass(frozen=True)
class MarketParams:
    mcr: D = D("1.40")  # minimum collateral ratio
    origination_fee: D = D("0.005")  # one-time, charged at mint
    min_debt: D = D("200")  # dust floor, as in Liquity
    min_rate: D = D("0.005")
    max_rate: D = D("0.25")


# --------------------------------------------------------------------------
# logic
# --------------------------------------------------------------------------


@dataclass
class Market:
    params: MarketParams = field(default_factory=MarketParams)

    # -- valuation ---------------------------------------------------------

    def collateral_value(self, trove: Trove, price: D) -> D:
        """USD value of a trove's collateral.

        The Chainlink feed for a Robinhood Chain stock token already includes
        the corporate-action multiplier, so the quoted price is the token's
        full price. Do NOT also multiply by `uiMultiplier()`: that double
        counts every dividend ever accrued, an error that starts at zero and
        grows silently for years.
        """
        return trove.collateral * price

    # -- interest ----------------------------------------------------------

    def pending_interest(self, trove: Trove, now: int) -> D:
        """Interest accrued since `last_update`, not yet folded into debt.

        Linear on the recorded debt, matching Liquity V2. Because the debt is
        re-recorded on every interaction, this compounds at whatever cadence
        the borrower touches the position.
        """
        elapsed = max(0, now - trove.last_update)
        return trove.debt * trove.rate * D(elapsed) / SECONDS_PER_YEAR

    def debt_at(self, trove: Trove, now: int) -> D:
        """Total owed right now: recorded debt plus interest since."""
        return trove.debt + self.pending_interest(trove, now)

    def accrue(self, trove: Trove, now: int) -> Trove:
        """Fold pending interest into the recorded debt.

        Note what this does *not* do: it never touches collateral. Interest is
        a growing lien, paid only on close, adjust, or liquidation.

        Rejects a clock that has moved backwards. Silently rewinding
        `last_update` would let the same period be charged twice on the next
        forward accrual, so the model fails loudly instead.
        """
        wall_time(now, "accrual time")
        if now < trove.last_update:
            raise TroveError(
                f"clock went backwards: {now} < last_update {trove.last_update}"
            )
        return replace(trove, debt=self.debt_at(trove, now), last_update=now)

    # -- health ------------------------------------------------------------

    def collateral_ratio(self, trove: Trove, price: D, now: int) -> D:
        """Collateral value divided by debt. 1.60 means 160%."""
        debt = self.debt_at(trove, now)
        if debt <= 0:
            return D("Infinity")
        return self.collateral_value(trove, price) / debt

    def ltv(self, trove: Trove, price: D, now: int) -> D:
        """Loan to value, the reciprocal of the collateral ratio."""
        value = self.collateral_value(trove, price)
        if value <= 0:
            return D("Infinity")
        return self.debt_at(trove, now) / value

    def is_healthy(self, trove: Trove, price: D, now: int) -> bool:
        return self.collateral_ratio(trove, price, now) >= self.params.mcr

    def liquidation_price(self, trove: Trove, now: int) -> D:
        """Price at which this trove hits the minimum collateral ratio."""
        if trove.collateral <= 0:
            return D("Infinity")
        return self.debt_at(trove, now) * self.params.mcr / trove.collateral

    # -- capacity ----------------------------------------------------------

    def max_borrow(self, trove: Trove, price: D, now: int, target_cr: D | None = None) -> D:
        """Additional FUSD mintable while staying at or above `target_cr`.

        Solves `value / (debt + drawn + fee) = target_cr` for `drawn`, where
        the fee is charged on the amount drawn and added to the debt.
        """
        target = target_cr if target_cr is not None else self.params.mcr
        headroom = self.collateral_value(trove, price) / target - self.debt_at(trove, now)
        if headroom <= 0:
            return D(0)
        return headroom / (D(1) + self.params.origination_fee)

    # -- operations --------------------------------------------------------

    def open_trove(
        self, *, collateral: D, borrow: D, rate: D, price: D, now: int
    ) -> Trove:
        """Deposit collateral and mint `borrow` FUSD against it.

        The borrower receives exactly `borrow`. The origination fee is added
        to the debt on top, so they owe slightly more than they received.
        """
        p = self.params
        positive(collateral, "collateral")
        positive(borrow, "borrow amount")
        positive(price, "price")
        non_negative(rate, "rate")
        wall_time(now, "open time")
        if not (p.min_rate <= rate <= p.max_rate):
            raise TroveError(f"rate {rate:.2%} outside [{p.min_rate:.2%}, {p.max_rate:.2%}]")

        debt = borrow * (D(1) + p.origination_fee)
        if debt < p.min_debt:
            raise TroveError(f"debt {debt:.2f} below minimum {p.min_debt}")

        trove = Trove(collateral=collateral, debt=debt, rate=rate, last_update=now)
        cr = self.collateral_ratio(trove, price, now)
        if cr < p.mcr:
            raise TroveError(f"collateral ratio {cr:.1%} below minimum {p.mcr:.0%}")
        return trove

    def adjust(
        self,
        trove: Trove,
        *,
        price: D,
        now: int,
        collateral_delta: D = D(0),
        debt_delta: D = D(0),
        new_rate: D | None = None,
    ) -> Trove:
        """Add or remove collateral, draw or repay debt, and/or reprice.

        Positive deltas add collateral / draw more debt. Interest is folded in
        first, so the borrower always settles accrued interest on any touch.

        A trove already below the minimum ratio is in rescue mode: it accepts
        collateral deposits and debt repayments that strictly improve the
        ratio, and nothing else. Full repayment is exempt, having no ratio.
        """
        p = self.params
        positive(price, "price")
        finite(collateral_delta, "collateral delta")
        finite(debt_delta, "debt delta")
        if new_rate is not None:
            non_negative(new_rate, "rate")
        t = self.accrue(trove, now)
        cr_before = self.collateral_ratio(t, price, now)

        new_collateral = t.collateral + collateral_delta
        if new_collateral < 0:
            raise TroveError("cannot withdraw more collateral than deposited")

        fee = debt_delta * p.origination_fee if debt_delta > 0 else D(0)
        new_debt = t.debt + debt_delta + fee
        if new_debt < 0:
            raise TroveError("cannot repay more than owed; use close_trove")
        if 0 < new_debt < p.min_debt:
            raise TroveError(f"debt {new_debt:.2f} below minimum {p.min_debt}")

        rate = new_rate if new_rate is not None else t.rate
        if not (p.min_rate <= rate <= p.max_rate):
            raise TroveError(f"rate {rate:.2%} outside allowed range")

        t = replace(t, collateral=new_collateral, debt=new_debt, rate=rate)
        cr = self.collateral_ratio(t, price, now)
        if new_debt > 0 and cr < p.mcr:
            # Below the floor the position is in rescue mode: collateral may
            # only go in and debt may only go out, and the move must strictly
            # improve the ratio. "Improves the ratio" alone is too permissive,
            # because a large enough deposit also licenses fresh borrowing and
            # a large enough repayment licenses a collateral withdrawal. Both
            # increase absolute exposure on an already-sick trove, which is a
            # separate protocol decision and not one to let in by side effect.
            if collateral_delta < 0 or debt_delta > 0:
                raise TroveError(
                    f"CR {cr:.1%} is below {p.mcr:.0%}: while under the floor a "
                    "trove accepts collateral deposits and repayments only"
                )
            if cr <= cr_before:
                raise TroveError(
                    f"adjustment would leave CR at {cr:.1%}, below {p.mcr:.0%}, "
                    f"without improving on {cr_before:.1%}"
                )
        return t

    def close_trove(self, trove: Trove, now: int) -> tuple[D, D]:
        """Repay everything and withdraw the collateral.

        Returns `(repayment_owed, collateral_released)`. The repayment exceeds
        what was originally borrowed by the accrued interest plus the
        origination fee, so the borrower must source the difference.
        """
        return self.debt_at(trove, now), trove.collateral


# --------------------------------------------------------------------------
# leverage helpers
# --------------------------------------------------------------------------


def leverage_at(cr: D) -> D:
    """Exposure per unit of equity when looping down to `cr`.

    Each round redeposits what the last one minted, so total collateral is a
    geometric series: `1 / (1 - 1/cr)`. At the 140% floor that is 3.5x, which
    is a ceiling nobody can hold, since a position sitting exactly at the MCR
    is liquidated by the first tick of interest.
    """
    if cr <= 1:
        raise ValueError("collateral ratio must exceed 1")
    return D(1) / (D(1) - D(1) / cr)


def loop_rounds(equity_value: D, cr: D, rounds: int = 6) -> Iterator[tuple[int, D, D]]:
    """Yield `(round, collateral_added, debt_minted)` for a looped position.

    Illustrative: shows the series converging. Use `leverage_at` for the
    closed form rather than summing this.
    """
    added = equity_value
    for i in range(1, rounds + 1):
        minted = added / cr
        yield i, added, minted
        added = minted


def time_to_liquidation(
    cr: D, rate: D, collateral_yield: D = D(0), mcr: D = D("1.40")
) -> D:
    """Years until interest drift alone reaches the MCR, with a flat price.

    Debt grows at `rate`, collateral grows at `collateral_yield` through the
    dividend multiplier. Assumes periodic compounding on both sides, so it is
    an approximation of the linear accrual in `pending_interest`, but a good
    one over multi-year horizons.

    Returns infinity when the collateral out-earns the debt.
    """
    if cr <= mcr:
        return D(0)
    ratio = (D(1) + collateral_yield) / (D(1) + rate)
    if ratio >= 1:
        return D("Infinity")
    return (mcr / cr).ln() / ratio.ln()


# --------------------------------------------------------------------------
# demo
# --------------------------------------------------------------------------

if __name__ == "__main__":
    market = Market()
    price = D("650")  # sSPX, USD per token
    t0 = 0
    year = int(SECONDS_PER_YEAR)

    # $1,600 of collateral backing $1,000 of debt, the worked example
    # from the protocol doc.
    collateral = D("1600") / price
    trove = market.open_trove(
        collateral=collateral, borrow=D("1000"), rate=D("0.06"), price=price, now=t0
    )

    print(f"{trove}")
    print(f"  collateral value  ${market.collateral_value(trove, price):>10,.2f}")
    print(f"  debt              ${market.debt_at(trove, t0):>10,.2f}  (incl. 0.5% fee)")
    print(f"  collateral ratio   {market.collateral_ratio(trove, price, t0):>10.1%}")
    print(f"  LTV                {market.ltv(trove, price, t0):>10.1%}")
    print(f"  liquidates at     ${market.liquidation_price(trove, t0):>10,.2f}")
    print(f"  can still borrow  ${market.max_borrow(trove, price, t0):>10,.2f}")

    print("\nafter one year, price flat, position untouched:")
    print(f"  debt              ${market.debt_at(trove, year):>10,.2f}")
    print(f"  collateral ratio   {market.collateral_ratio(trove, price, year):>10.1%}")
    print(f"  still healthy?     {str(market.is_healthy(trove, price, year)):>10}")

    print("\nleverage by target ratio:")
    for cr in ("1.40", "1.60", "1.75", "2.00"):
        print(f"  CR {cr}  ->  {leverage_at(D(cr)):.2f}x")

    print("\ninterest drift to liquidation from 160% CR, flat price:")
    for div in ("0.000", "0.012"):
        years = time_to_liquidation(D("1.60"), D("0.06"), D(div))
        print(f"  dividend {D(div):.1%}  ->  {years:.1f} years")
