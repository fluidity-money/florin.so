"""Input validation at public boundaries.

A reference model has no type system stopping a caller passing a negative
amount, and signed arithmetic will happily fabricate balances from one:
`withdraw(-100)` from an empty pool credits 100. Solidity's unsigned integers
make that impossible for free, so the model has to buy it explicitly.
"""

from __future__ import annotations

from decimal import Decimal

D = Decimal


class AmountError(ValueError):
    """A quantity was negative, non-finite, or otherwise out of domain."""


def finite(amount: D, what: str = "amount") -> D:
    if not isinstance(amount, Decimal):
        raise AmountError(f"{what} must be a Decimal, got {type(amount).__name__}")
    if not amount.is_finite():
        raise AmountError(f"{what} must be finite, got {amount}")
    return amount


def non_negative(amount: D, what: str = "amount") -> D:
    finite(amount, what)
    if amount < 0:
        raise AmountError(f"{what} must not be negative, got {amount}")
    return amount


def positive(amount: D, what: str = "amount") -> D:
    finite(amount, what)
    if amount <= 0:
        raise AmountError(f"{what} must be positive, got {amount}")
    return amount


def fraction(value: D, what: str = "fraction") -> D:
    """A rate or ratio in [0, 1]."""
    finite(value, what)
    if not (0 <= value <= 1):
        raise AmountError(f"{what} must be within [0, 1], got {value}")
    return value


def wall_time(value: object, what: str = "wall time") -> int:
    """A unix timestamp: a real non-negative int.

    Deliberately strict about type. A float sails through the annotations and
    then poisons the accrual clock: `float("nan")` defeats every comparison,
    so it passes the monotonicity check, lands in `last_update`, and erases
    the next accrual interval. A later valid timestamp replaces it and
    interest resumes, so the loss is one interval, not the whole history.
    `bool` is excluded because it is an `int` subclass and `True` would read
    as timestamp 1.
    """
    if isinstance(value, bool) or not isinstance(value, int):
        raise AmountError(f"{what} must be an int, got {type(value).__name__} {value!r}")
    if value < 0:
        raise AmountError(f"{what} must not be negative, got {value}")
    return value
