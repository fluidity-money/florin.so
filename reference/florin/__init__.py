"""Florin: a reference implementation of a CDP lending market for tokenized stocks.

    from decimal import Decimal as D
    from florin import Florin, StockToken, PriceFeed

    token = StockToken()
    token.mint("alice", D("10"))
    feed = PriceFeed(token, share_price=D("650"))
    florin = Florin(token=token, feed=feed)

    florin.open_trove("alice", collateral=D("4"), borrow=D("1500"),
                      rate=D("0.06"), wall=0)

Run `python3 -m florin.demo` for an end-to-end scenario.
"""

from .collateral import PriceFeed, StockToken, TransferBlocked, apply_split, pay_dividend
from .core import (
    Market,
    MarketParams,
    Trove,
    TroveError,
    leverage_at,
    loop_rounds,
    time_to_liquidation,
)
from .guards import AmountError
from .pool import PoolError, StabilityPool
from .protocol import PROTOCOL, TREASURY, Clock, Florin, ProtocolError

__all__ = [
    "AmountError",
    "Clock",
    "Florin",
    "Market",
    "MarketParams",
    "PROTOCOL",
    "PoolError",
    "PriceFeed",
    "ProtocolError",
    "StabilityPool",
    "StockToken",
    "TREASURY",
    "TransferBlocked",
    "Trove",
    "TroveError",
    "apply_split",
    "leverage_at",
    "loop_rounds",
    "pay_dividend",
    "time_to_liquidation",
]
