"""The Stability Pool: depositors who absorb liquidations.

Depositors park FUSD. When a trove is liquidated, the pool burns its debt and
receives its collateral, so depositors end up involuntarily long the
collateral at a discount. In exchange they earn that discount plus a share of
the interest every borrower pays.

Accounting note. Production Liquity tracks compounded deposits with product
and sum snapshots (the famous P and S) so that a liquidation is O(1) rather
than O(depositors). That is a gas optimisation, not a behavioural one. This
implementation rescales every depositor explicitly on each event, which is
O(n) and obviously correct, and is the thing a port should be diffed against.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from .guards import non_negative, positive

D = Decimal


class PoolError(Exception):
    pass


@dataclass
class StabilityPool:
    """FUSD deposits and the collateral gains they have earned.

    Once attached to a `Florin`, `managed` is set and the membership methods
    refuse direct calls. Deposits and withdrawals have to settle outstanding
    interest first, and a bare `pool.deposit(who, amount)` carries no
    timestamp with which to do that: a depositor joining an instant before a
    year of unsettled interest is distributed would collect a year of it.
    Since the call cannot say when it happened, it is closed rather than
    guessed at. `claim` is closed too, because it hands back a number the
    caller is trusted to settle. Use `Florin.deposit_pool`,
    `Florin.withdraw_pool` and `Florin.claim_pool_gains`.
    """

    deposits: dict[str, D] = field(default_factory=dict)
    gains: dict[str, D] = field(default_factory=dict)  # raw collateral tokens
    managed: bool = False

    # -- views -------------------------------------------------------------

    @property
    def total(self) -> D:
        return sum(self.deposits.values(), D(0))

    @property
    def total_gains(self) -> D:
        return sum(self.gains.values(), D(0))

    def deposit_of(self, who: str) -> D:
        return self.deposits.get(who, D(0))

    def gain_of(self, who: str) -> D:
        return self.gains.get(who, D(0))

    def coverage(self, total_system_debt: D) -> D:
        """Pool size as a fraction of system debt.

        A high advertised yield means this number is low: the same interest
        revenue split across fewer depositors. Read it as a warning light,
        not as profit.
        """
        if total_system_debt <= 0:
            return D("Infinity")
        return self.total / total_system_debt

    # -- depositor actions -------------------------------------------------

    def deposit(self, who: str, amount: D) -> None:
        self._require_unmanaged("deposit_pool")
        self._deposit(who, amount)

    def _deposit(self, who: str, amount: D) -> None:
        positive(amount, "deposit")
        self.deposits[who] = self.deposit_of(who) + amount

    def withdraw(self, who: str, amount: D) -> D:
        """Withdraw FUSD. Returns the amount actually paid out."""
        self._require_unmanaged("withdraw_pool")
        return self._withdraw(who, amount)

    def _withdraw(self, who: str, amount: D) -> D:
        non_negative(amount, "withdrawal")
        held = self.deposit_of(who)
        if amount > held:
            raise PoolError(f"cannot withdraw {amount:.2f}, deposit is {held:.2f}")
        self.deposits[who] = held - amount
        return amount

    def _require_unmanaged(self, instead: str) -> None:
        if self.managed:
            raise PoolError(
                f"pool is managed by a Florin instance; call Florin.{instead}(...) "
                "so that outstanding interest is settled before membership changes"
            )

    def claim(self, who: str) -> D:
        """Take the collateral won from liquidations. Returns raw tokens.

        Closed once managed, for the same reason as deposit and withdraw: it
        zeroes the entitlement and hands the number back for the caller to
        settle. Called directly on a managed pool that settlement never
        happens, so the gain is erased without the tokens moving.
        """
        self._require_unmanaged("claim_pool_gains")
        return self._claim(who)

    def _claim(self, who: str) -> D:
        won = self.gain_of(who)
        self.gains[who] = D(0)
        return won

    # -- protocol actions --------------------------------------------------

    def absorb(self, debt: D, collateral: D) -> None:
        """Burn `debt` of deposits and hand `collateral` to depositors.

        Callers must check `total >= debt` first; a pool that cannot cover a
        liquidation is a redistribution, which is the protocol's problem to
        handle, not the pool's.
        """
        non_negative(debt, "absorbed debt")
        non_negative(collateral, "absorbed collateral")
        total = self.total
        if debt > total:
            raise PoolError(f"pool holds {total:.2f}, cannot absorb {debt:.2f}")
        if total == 0:
            raise PoolError("empty pool cannot absorb")

        burn_ratio = debt / total
        for who, amount in list(self.deposits.items()):
            share = amount / total
            self.deposits[who] = amount - amount * burn_ratio
            self.gains[who] = self.gain_of(who) + collateral * share

    def distribute_interest(self, amount: D) -> None:
        """Credit borrower interest to depositors pro rata.

        The FUSD is newly minted against the matching growth in trove debt,
        so system-wide supply still equals system-wide debt.
        """
        non_negative(amount, "interest")
        total = self.total
        if total <= 0 or amount <= 0:
            return
        for who, held in list(self.deposits.items()):
            self.deposits[who] = held + amount * (held / total)
