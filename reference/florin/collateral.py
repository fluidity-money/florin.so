"""The collateral asset: a Robinhood Chain Stock Token, and its price feed.

Modelled from the deployed SPY token on chain 4663
(0x117cc2133c37b721f49de2a7a74833232b3b4c0c), which is a beacon proxy whose
implementation exposes `pause`, `unpause`, `paused`, `isBlocked`, `mint`,
`burn`, `uiMultiplier` and `balanceOfUI`.

The two behaviours worth modelling faithfully, because Florin's correctness
depends on both:

1. Dividends reinvest into a multiplier rather than being distributed. Raw
   balances never move; each token comes to represent more than one share.
2. A third party can pause transfers at any time. Everything downstream of
   that (liquidation, redemption, the Stability Pool) stops with it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from .guards import finite, fraction, non_negative, positive

D = Decimal

ONE = D(1)


class TransferBlocked(Exception):
    """The token refused a transfer: paused, blocked, or insufficient balance."""


@dataclass
class StockToken:
    """An ERC-20 stock token with a corporate-action multiplier.

    `balances` are raw amounts and never change on a dividend, exactly as on
    chain. What changes is `ui_multiplier`, which scales raw balance to
    underlying shares.
    """

    symbol: str = "SPY"
    balances: dict[str, D] = field(default_factory=dict)
    ui_multiplier: D = ONE  # starts at 1.0; reads 1.0 on mainnet today
    paused: bool = False
    blocked: set[str] = field(default_factory=set)

    # -- ERC-20 -----------------------------------------------------------

    def balance_of(self, who: str) -> D:
        """Raw token balance. This is what a contract should store."""
        return self.balances.get(who, D(0))

    def balance_of_ui(self, who: str) -> D:
        """Underlying shares represented. For display and accounting only.

        Never use this to value collateral: the price feed already carries
        the multiplier, so pairing the two double counts. See `PriceFeed`.
        """
        return self.balance_of(who) * self.ui_multiplier

    def transfer(self, sender: str, to: str, amount: D) -> None:
        non_negative(amount, "transfer amount")
        if self.paused:
            raise TransferBlocked(f"{self.symbol} transfers are paused")
        if sender in self.blocked or to in self.blocked:
            raise TransferBlocked(f"{self.symbol}: address is blocked")
        if self.balance_of(sender) < amount:
            raise TransferBlocked(f"{self.symbol}: insufficient balance")
        self.balances[sender] = self.balance_of(sender) - amount
        self.balances[to] = self.balance_of(to) + amount

    def mint(self, to: str, amount: D) -> None:
        """Issuer-only on chain. Here it seeds test scenarios."""
        non_negative(amount, "mint amount")
        self.balances[to] = self.balance_of(to) + amount

    # -- operator powers ---------------------------------------------------

    def pause(self) -> None:
        self.paused = True

    def unpause(self) -> None:
        self.paused = False

    def block(self, who: str) -> None:
        self.blocked.add(who)

    def is_blocked(self, who: str) -> bool:
        return who in self.blocked


@dataclass
class PriceFeed:
    """Chainlink-style feed for a stock token.

    Reports price **per token**, with the corporate-action multiplier already
    applied. A consumer multiplies a raw balance by this and stops there.

    This is the single most dangerous integration detail in the system, so it
    lives behind a method rather than a bare attribute: `share_price` is the
    price of one underlying share and is deliberately awkward to reach for.
    """

    token: StockToken
    share_price: D = D("650")

    def __post_init__(self) -> None:
        positive(self.share_price, "share price")

    def latest(self) -> D:
        """Price of one token, dividends included."""
        return self.share_price * self.token.ui_multiplier

    def set_share_price(self, price: D) -> None:
        self.share_price = positive(price, "share price")

    def move(self, pct: D) -> None:
        """Move the underlying share price by a fraction. -0.12 is a 12% drop.

        Routed through `set_share_price` so the result is validated. Assigning
        directly let a scenario set an infinite or negative price, and a zero
        price makes every position infinitely collateralised while paying out
        no collateral on redemption.
        """
        finite(pct, "price move")
        self.set_share_price(self.share_price * (ONE + pct))


# --------------------------------------------------------------------------
# corporate actions
# --------------------------------------------------------------------------


def pay_dividend(feed: PriceFeed, per_share: D, withholding: D = D("0.30")) -> D:
    """Process an ex-dividend date with automatic reinvestment.

    On the ex-date the share price drops by the full dividend. The net amount
    after withholding is reinvested at the post-drop price, which raises the
    multiplier. Returns the new multiplier.

    The invariant worth knowing: with zero withholding the token price is
    completely unchanged through a dividend, because the price drop and the
    multiplier increase cancel exactly. Withholding is the only thing that
    makes a holder poorer, and it costs `per_share * withholding` per share.

    Whether the real token withholds at all, and whether it steps on the
    ex-date or the pay-date, is still unobserved: `ui_multiplier` reads
    exactly 1.0 on mainnet.
    """
    positive(per_share, "dividend per share")
    fraction(withholding, "withholding")
    token = feed.token
    ex_price = feed.share_price - per_share
    if ex_price <= 0:
        raise ValueError("dividend cannot exceed the share price")

    reinvested = per_share * (ONE - withholding)
    feed.share_price = ex_price
    token.ui_multiplier = token.ui_multiplier * (ONE + reinvested / ex_price)
    return token.ui_multiplier


def apply_split(feed: PriceFeed, ratio: D) -> D:
    """A 2-for-1 split is `ratio=2`.

    Takes the feed rather than the token because a split is only value
    neutral if the multiplier and the share price move together. Doing one
    without the other silently doubles or halves every position, so the two
    updates are not separable and this helper does both.
    """
    positive(ratio, "split ratio")
    # Compute both results before assigning either. A ratio small enough to
    # pass the positive-finite check can still overflow the division, which
    # would otherwise leave the multiplier updated and the price stale.
    new_multiplier = positive(feed.token.ui_multiplier * ratio, "split multiplier")
    new_price = positive(feed.share_price / ratio, "split share price")
    feed.token.ui_multiplier = new_multiplier
    feed.share_price = new_price
    return feed.token.ui_multiplier
