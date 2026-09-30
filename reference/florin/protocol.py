"""Florin: the protocol tying troves, the Stability Pool and the peg together.

Covers the three things `core.py` deliberately left out: routing interest to
the Stability Pool, liquidating unhealthy troves (with redistribution when the
pool is too small), and redeeming FUSD against the cheapest troves to defend
the peg.

Plus one mechanism no Liquity-derived system needs but this one does. The
collateral can be paused by its issuer at any time. When that happens Florin
freezes: liquidations and redemptions suspend, and crucially the interest
clock stops, so borrowers are not charged for a freeze they did not cause and
cannot escape.

Two model-wide conventions worth knowing before reading further.

*Atomicity.* Python has no transaction reversion, so every public mutating
method runs inside `_atomic`, which snapshots the full ledger and restores it
if anything raises. Without that, a partially applied operation leaves the
system inconsistent: a repayment that fails on insufficient funds would
already have reduced the debt.

*Snapshot semantics.* `total_debt`, `total_collateral` and
`total_collateral_ratio` report the last settled state, not state at some
requested wall time. Call `accrue_all` first if you need them current.
"""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field, replace
from decimal import Decimal
from typing import Iterator

from .collateral import PriceFeed, StockToken
from .core import Market, Trove
from .guards import non_negative, positive, wall_time
from .pool import StabilityPool

D = Decimal
ONE = D(1)

PROTOCOL = "florin"
TREASURY = "treasury"


class ProtocolError(Exception):
    pass


# --------------------------------------------------------------------------


@dataclass
class Clock:
    """Accrual time, which stops while the collateral is frozen.

    Troves record `last_update` against this clock rather than wall time, so
    a pause is simply a stretch of wall time the clock never sees.
    """

    _banked: int = 0  # accruable seconds before the current running segment
    _started: int = 0  # wall time the current segment began
    _running: bool = True

    def now(self, wall: int) -> int:
        return self._banked + (wall - self._started) if self._running else self._banked

    def freeze(self, wall: int) -> None:
        if self._running:
            self._banked += wall - self._started
            self._running = False

    def resume(self, wall: int) -> None:
        if not self._running:
            self._started = wall
            self._running = True

    @property
    def frozen(self) -> bool:
        return not self._running


# --------------------------------------------------------------------------


@dataclass
class Florin:
    token: StockToken
    feed: PriceFeed
    market: Market = field(default_factory=Market)
    pool: StabilityPool = field(default_factory=StabilityPool)

    troves: dict[str, Trove] = field(default_factory=dict)
    fusd: dict[str, D] = field(default_factory=dict)  # FUSD held outside the pool
    surplus: dict[str, D] = field(default_factory=dict)  # collateral owed back
    clock: Clock = field(default_factory=Clock)

    treasury: D = D(0)
    bad_debt: D = D(0)
    default_collateral: D = D(0)  # seized collateral with no trove left to hold it

    redemption_fee: D = D("0.005")
    sp_interest_share: D = D("0.75")  # remainder funds protocol liquidity

    _last_event: int = 0  # newest wall time accepted by any timed mutation
    _last_live: int = 0  # newest wall time at which the token was seen unpaused

    def __post_init__(self) -> None:
        # Close the pool's direct membership API: entry and exit must settle
        # interest first, which needs a timestamp only Florin has.
        self.pool.managed = True

    # -- atomicity ---------------------------------------------------------

    def _snapshot(self) -> tuple:
        return (
            dict(self.troves),
            dict(self.fusd),
            dict(self.surplus),
            dict(self.token.balances),
            set(self.token.blocked),
            self.token.paused,
            self.token.ui_multiplier,
            self.feed.share_price,
            dict(self.pool.deposits),
            dict(self.pool.gains),
            self.treasury,
            self.bad_debt,
            self.default_collateral,
            (self.clock._banked, self.clock._started, self.clock._running),
            self._last_event,
            self._last_live,
        )

    def _restore(self, snap: tuple) -> None:
        (
            self.troves,
            self.fusd,
            self.surplus,
            self.token.balances,
            self.token.blocked,
            self.token.paused,
            self.token.ui_multiplier,
            self.feed.share_price,
            self.pool.deposits,
            self.pool.gains,
            self.treasury,
            self.bad_debt,
            self.default_collateral,
            clock,
            self._last_event,
            self._last_live,
        ) = snap
        self.clock._banked, self.clock._started, self.clock._running = clock

    @contextmanager
    def _atomic(self) -> Iterator[None]:
        """All-or-nothing. Stands in for Solidity's automatic reversion."""
        snap = self._snapshot()
        try:
            yield
        except Exception:
            self._restore(snap)
            raise

    # -- helpers -----------------------------------------------------------

    def price(self) -> D:
        """Price per collateral token. Multiplier already included."""
        return self.feed.latest()

    def balance(self, who: str) -> D:
        return self.fusd.get(who, D(0))

    def _credit(self, who: str, amount: D) -> None:
        non_negative(amount, "credit")
        self.fusd[who] = self.balance(who) + amount

    def _debit(self, who: str, amount: D) -> None:
        non_negative(amount, "debit")
        if self.balance(who) < amount:
            raise ProtocolError(f"{who} holds {self.balance(who):.2f} FUSD, needs {amount:.2f}")
        self.fusd[who] = self.balance(who) - amount

    def _require_active(self) -> None:
        if self.token.paused:
            raise ProtocolError(
                "collateral is paused: liquidations and redemptions are suspended"
            )

    def _trove(self, owner: str) -> Trove:
        if owner not in self.troves:
            raise ProtocolError(f"{owner} has no trove")
        return self.troves[owner]

    def _sync_clock(self, wall: int) -> None:
        """Validate the timestamp, then align the clock with the pause flag.

        Two watermarks, because they answer different questions.
        `_last_event` is the newest wall time any timed mutation has been
        accepted at, and every operation must be at or after it: that is what
        stops a backdated call re-charging a period. It advances even while
        frozen, so a pause is not a window in which history can be rewritten.

        `_last_live` is the newest time the token was observed unpaused, and
        it is where the clock stops when a pause is discovered. A pause
        applied straight to the token carries no timestamp, so the last moment
        we know it was live is the best available answer, and it never
        over-charges a borrower. Route pauses through `Florin.pause` to stop
        the clock precisely.
        """
        wall_time(wall)
        if wall < self._last_event:
            raise ProtocolError(
                f"wall clock went backwards: {wall} < last accepted event {self._last_event}"
            )
        self._last_event = wall
        if self.token.paused:
            if not self.clock.frozen:
                self.clock.freeze(self._last_live)
        else:
            if self.clock.frozen:
                self.clock.resume(wall)
            self._last_live = wall

    # -- aggregate views ---------------------------------------------------

    @property
    def total_debt(self) -> D:
        """Last settled debt. Not time-aware; call `accrue_all` first."""
        return sum(t.debt for t in self.troves.values()) + self.bad_debt

    @property
    def total_collateral(self) -> D:
        return sum(t.collateral for t in self.troves.values())

    @property
    def fusd_supply(self) -> D:
        return sum(self.fusd.values(), D(0)) + self.pool.total

    def total_collateral_ratio(self) -> D:
        """How well the *live* book is capitalised.

        Excludes `bad_debt` and the `default_collateral` standing behind it:
        neither belongs to a trove, and mixing them in measures two different
        things at once. Use `system_solvency` for whole-system coverage.
        """
        debt = sum(t.debt for t in self.troves.values())
        if debt <= 0:
            return D("Infinity")
        return self.total_collateral * self.price() / debt

    def system_solvency(self) -> D:
        """Every collateral token in custody against every liability.

        Includes defaulted positions on both sides. Below 1.0 the system owes
        more FUSD than its collateral is worth.
        """
        debt = self.total_debt
        if debt <= 0:
            return D("Infinity")
        return (self.total_collateral + self.default_collateral) * self.price() / debt

    # -- lifecycle ---------------------------------------------------------

    def open_trove(
        self, owner: str, *, collateral: D, borrow: D, rate: D, wall: int
    ) -> Trove:
        with self._atomic():
            self._require_active()
            self._sync_clock(wall)
            if owner in self.troves:
                raise ProtocolError(f"{owner} already has a trove")
            now = self.clock.now(wall)

            # Validate the whole state transition before moving any collateral,
            # so a rejected open never leaves tokens in protocol custody.
            trove = self.market.open_trove(
                collateral=collateral, borrow=borrow, rate=rate, price=self.price(), now=now
            )
            self.token.transfer(owner, PROTOCOL, collateral)
            self.troves[owner] = trove

            # The borrower receives `borrow`; the upfront interest is minted
            # so FUSD supply still equals total trove debt. It is interest, not
            # a fee, so it is split the same way accrued interest is rather
            # than going wholly to the treasury.
            self._credit(owner, borrow)
            self._settle_interest(trove.debt - borrow)
            return trove

    def adjust_trove(self, owner: str, *, wall: int, **kwargs) -> Trove:
        """Add or remove collateral, draw or repay debt, and/or reprice.

        While the collateral is frozen the only permitted adjustment is pure
        repayment: it moves FUSD only, needs no token transfer, and helping a
        borrower deleverage during a freeze they cannot escape is the point.
        Drawing more debt is refused, which would otherwise slip through the
        token-level pause because minting touches no collateral.
        """
        collateral_delta = kwargs.get("collateral_delta", D(0))
        debt_delta = kwargs.get("debt_delta", D(0))
        # Repricing is excluded: a rate change moves the trove in the
        # redemption queue, which is a position taken, not a deleveraging.
        repayment_only = (
            collateral_delta == 0 and debt_delta < 0 and kwargs.get("new_rate") is None
        )

        with self._atomic():
            if self.token.paused and not repayment_only:
                raise ProtocolError(
                    "collateral is paused: only debt repayment is available"
                )
            self._sync_clock(wall)
            self.accrue_all(wall)
            now = self.clock.now(wall)
            t = self._trove(owner)

            before = t.debt
            t = self.market.adjust(t, price=self.price(), now=now, **kwargs)

            # Settle FUSD before moving collateral, so an insufficient balance
            # is discovered before any token leaves custody.
            minted = t.debt - before
            if debt_delta > 0:
                self._credit(owner, debt_delta)
                fee = minted - debt_delta
                self._credit(TREASURY, fee)
                self.treasury += fee
            elif debt_delta < 0:
                self._debit(owner, -debt_delta)

            if collateral_delta > 0:
                self.token.transfer(owner, PROTOCOL, collateral_delta)
            elif collateral_delta < 0:
                self.token.transfer(PROTOCOL, owner, -collateral_delta)

            self.troves[owner] = t
            return t

    def close_trove(self, owner: str, wall: int) -> tuple[D, D]:
        with self._atomic():
            self._require_active()
            self._sync_clock(wall)
            self.accrue_all(wall)
            now = self.clock.now(wall)
            t = self._trove(owner)
            owed, collateral = self.market.close_trove(t, now)

            self._debit(owner, owed)
            self.token.transfer(PROTOCOL, owner, collateral)
            del self.troves[owner]
            return owed, collateral

    # -- interest ----------------------------------------------------------

    def _settle_interest(self, amount: D) -> None:
        """Route interest to the pool and the treasury.

        Shared by accrual and by the interest charged in advance at open: the
        deployed contract folds the upfront amount into the same mint and
        split, so both arrive the same way here. With an empty pool the whole
        amount falls through to the treasury, since there is nobody to pay.
        """
        if amount <= 0:
            return
        to_pool = amount * self.sp_interest_share
        to_treasury = amount - to_pool
        if self.pool.total > 0:
            self.pool.distribute_interest(to_pool)
        else:
            to_treasury += to_pool
        self._credit(TREASURY, to_treasury)
        self.treasury += to_treasury

    def accrue_all(self, wall: int) -> D:
        """Fold interest into every trove and mint the matching FUSD.

        Returns the total interest accrued. Newly minted FUSD is backed by the
        matching growth in trove debt, so `fusd_supply == total_debt` holds
        across the call.

        Cadence note: interest is linear between settlements but compounds at
        each one, and this settles *everyone* whenever *anyone* acts. Total
        interest therefore depends on how often the protocol is touched. A
        single annual settlement at 10% yields 1,105.50 on 1,005 of debt where
        monthly settlement yields 1,110.24. That is a deliberate simplification
        of Liquity's aggregate-index accounting, which is cadence independent.
        """
        with self._atomic():
            self._sync_clock(wall)
            now = self.clock.now(wall)
            total = D(0)
            for owner, t in list(self.troves.items()):
                if now < t.last_update:
                    raise ProtocolError(
                        f"clock went backwards for {owner}: {now} < {t.last_update}"
                    )
                interest = self.market.pending_interest(t, now)
                if interest > 0:
                    self.troves[owner] = self.market.accrue(t, now)
                    total += interest
                else:
                    self.troves[owner] = replace(t, last_update=now)

            if total > 0:
                self._settle_interest(total)
            return total

    # -- Stability Pool ----------------------------------------------------

    def deposit_pool(self, who: str, amount: D, wall: int) -> None:
        """Move FUSD into the Stability Pool, settling interest first.

        Settling before membership changes is what stops a depositor joining
        the instant before an overdue accrual and collecting interest earned
        while they were not in the pool. Always use this rather than poking
        `pool.deposit` directly.
        """
        with self._atomic():
            positive(amount, "deposit")
            self.accrue_all(wall)
            self._debit(who, amount)
            self.pool._deposit(who, amount)

    def withdraw_pool(self, who: str, amount: D, wall: int) -> D:
        """Take FUSD out of the pool, settling interest first."""
        with self._atomic():
            non_negative(amount, "withdrawal")
            self.accrue_all(wall)
            paid = self.pool._withdraw(who, amount)
            self._credit(who, paid)
            return paid

    def claim_pool_gains(self, who: str) -> D:
        """Take collateral won from liquidations out of the Stability Pool.

        Untimed, like `claim_surplus`: moving already-earned collateral
        changes no interest and needs no place in the event ordering. It took
        a `wall` argument that was never read, which advertised an ordering
        guarantee it did not provide.
        """
        with self._atomic():
            self._require_active()
            won = self.pool._claim(who)
            if won > 0:
                self.token.transfer(PROTOCOL, who, won)
            return won

    def claim_surplus(self, owner: str) -> D:
        with self._atomic():
            self._require_active()
            amount = self.surplus.pop(owner, D(0))
            if amount > 0:
                self.token.transfer(PROTOCOL, owner, amount)
            return amount

    # -- liquidation -------------------------------------------------------

    def liquidate(self, owner: str, wall: int) -> dict:
        """Close an unhealthy trove against the Stability Pool.

        Offsets as much as the pool can cover, then redistributes whatever is
        left to the surviving troves pro rata by collateral. If nothing
        survives to absorb it, the shortfall lands in `bad_debt` and its
        collateral in `default_collateral`.
        """
        with self._atomic():
            self._require_active()
            self._sync_clock(wall)
            self.accrue_all(wall)
            now = self.clock.now(wall)

            t = self._trove(owner)
            price = self.price()
            cr = self.market.collateral_ratio(t, price, now)
            if cr >= self.market.params.mcr:
                raise ProtocolError(f"{owner} is healthy at {cr:.1%}, cannot liquidate")

            debt, collateral = t.debt, t.collateral
            del self.troves[owner]

            offset = min(debt, self.pool.total)
            redistributed = debt - offset
            result = {"owner": owner, "debt": debt, "collateral": collateral, "cr": cr}

            if offset > 0:
                share = offset / debt
                self.pool.absorb(offset, collateral * share)
                collateral -= collateral * share
            result["offset"] = offset

            if redistributed > 0:
                self._redistribute(redistributed, collateral)
            result["redistributed"] = redistributed
            return result

    def _redistribute(self, debt: D, collateral: D) -> None:
        survivors = self.troves
        total_collateral = sum(t.collateral for t in survivors.values())
        if not survivors or total_collateral <= 0:
            # Nothing left to absorb it. Record the debt as a loss, but keep
            # the seized collateral on the books: it is still in custody and
            # is what any recovery would be paid from. `bad_debt` is gross
            # unoffset debt in FUSD; the net economic loss is
            # `bad_debt - default_collateral * price`, which is negative when
            # the seizure recovered more than the debt.
            self.bad_debt += debt
            self.default_collateral += collateral
            return
        for owner, t in list(survivors.items()):
            share = t.collateral / total_collateral
            self.troves[owner] = replace(
                t, debt=t.debt + debt * share, collateral=t.collateral + collateral * share
            )

    def liquidate_all(self, wall: int, max_passes: int = 20) -> list[dict]:
        """Sweep every underwater trove, riskiest first, until the book is stable.

        Repeated passes matter: redistribution loads debt onto the survivors,
        which can push a trove that was healthy at the start of the sweep
        underwater by the end of it. That cascade is the real failure mode of
        a single-collateral system, so it is modelled rather than hidden.
        """
        if isinstance(max_passes, bool) or not isinstance(max_passes, int) or max_passes < 1:
            raise ProtocolError(f"max_passes must be a positive int, got {max_passes!r}")
        with self._atomic():
            return self._liquidate_all(wall, max_passes)

    def _liquidate_all(self, wall: int, max_passes: int) -> list[dict]:
        self._require_active()
        self.accrue_all(wall)
        results: list[dict] = []
        for _ in range(max_passes):
            now, price = self.clock.now(wall), self.price()
            doomed = sorted(
                (o for o, t in self.troves.items() if not self.market.is_healthy(t, price, now)),
                key=lambda o: self.market.collateral_ratio(self.troves[o], price, now),
            )
            if not doomed:
                break
            for owner in doomed:
                if owner in self.troves:
                    results.append(self.liquidate(owner, wall))
        return results

    # -- redemption --------------------------------------------------------

    def redeem(self, redeemer: str, amount: D, wall: int) -> dict:
        """Swap FUSD for collateral at face value, cheapest troves first.

        This is what anchors the peg: below a dollar, anyone can buy FUSD and
        redeem it for a dollar of collateral, less the redemption fee. The
        trove redeemed against is not harmed in dollar terms and its ratio
        improves. What it loses is exposure, which is the price of a low rate.

        Troves below the minimum collateral ratio are skipped. Redeeming an
        insolvent position would demand more collateral than it owns, and the
        shortfall would come out of other borrowers' deposits. Those positions
        belong to `liquidate`, not here.
        """
        with self._atomic():
            self._require_active()
            self._sync_clock(wall)
            positive(amount, "redemption amount")
            self.accrue_all(wall)
            now = self.clock.now(wall)
            price = self.price()
            min_debt = self.market.params.min_debt

            if self.balance(redeemer) < amount:
                raise ProtocolError(f"{redeemer} holds {self.balance(redeemer):.2f} FUSD")

            remaining = amount
            paid_out = D(0)
            fees = D(0)
            touched: list[str] = []

            for owner in self._by_rate_ascending():
                if remaining <= 0:
                    break
                t = self.troves[owner]
                if self.market.collateral_ratio(t, price, now) < self.market.params.mcr:
                    continue

                take = min(remaining, t.debt)
                leftover = t.debt - take
                if 0 < leftover < min_debt:
                    if t.debt <= remaining:
                        take = t.debt  # affordable: clear the whole position
                    else:
                        take = t.debt - min_debt  # truncate, leave the floor intact
                if take <= 0:
                    continue

                collateral_out = take / price
                if collateral_out > t.collateral:
                    raise ProtocolError(
                        f"redeeming {owner} needs {collateral_out:.6f} collateral "
                        f"but the trove holds {t.collateral:.6f}"
                    )
                fee = collateral_out * self.redemption_fee

                new_debt = t.debt - take
                new_collateral = t.collateral - collateral_out
                touched.append(owner)

                if new_debt <= 0:
                    # Fully redeemed. Remaining collateral belongs to the
                    # borrower and is claimable.
                    self.surplus[owner] = self.surplus.get(owner, D(0)) + new_collateral
                    del self.troves[owner]
                else:
                    self.troves[owner] = replace(t, debt=new_debt, collateral=new_collateral)

                paid_out += collateral_out - fee
                fees += fee
                remaining -= take

            burned = amount - remaining
            if burned > 0:
                self._debit(redeemer, burned)
            if paid_out > 0:
                self.token.transfer(PROTOCOL, redeemer, paid_out)
            return {
                "burned": burned,
                "collateral_out": paid_out,
                "fee": fees,
                "troves_hit": touched,
                "unfilled": remaining,
            }

    def _by_rate_ascending(self) -> list[str]:
        """Redemption order. The cheapest rate is first in the queue."""
        return sorted(self.troves, key=lambda o: (self.troves[o].rate, o))

    # -- the pause ---------------------------------------------------------

    def pause(self, wall: int) -> None:
        """The issuer froze the collateral. Stop the world.

        Interest stops accruing, because a borrower cannot add collateral or
        be liquidated while frozen, and charging them for that window would
        penalise them for someone else's decision.
        """
        with self._atomic():
            self.accrue_all(wall)  # validates the timestamp and settles first
            self.token.pause()
            self.clock.freeze(wall)

    def unpause(self, wall: int) -> None:
        """Thaw. Synchronises *before* clearing the flag, which matters.

        If the issuer paused the token directly, the clock never froze, and
        clearing the flag first would leave that whole interval looking live
        and chargeable. Syncing while the flag is still set freezes the clock
        retroactively at `_last_live`, so the frozen span is excluded.
        """
        with self._atomic():
            self._sync_clock(wall)  # token still paused here: freezes the clock
            self.token.unpause()
            self.clock.resume(wall)
            self._last_live = wall

    # -- invariants --------------------------------------------------------

    def check_invariants(self) -> None:
        """Assert what must always hold. Call it after anything interesting.

        Supply equalling debt is necessary but nowhere near sufficient: a
        negative surplus offsets recorded obligations and hides a shortfall,
        which is exactly how an insolvent redemption used to pass this check.
        Every balance is therefore asserted non-negative in its own right.
        """
        eps = D("0.000001")

        supply, debt = self.fusd_supply, self.total_debt
        if abs(supply - debt) > eps:
            raise AssertionError(f"FUSD supply {supply:.6f} != total debt {debt:.6f}")

        held = self.token.balance_of(PROTOCOL)
        owed = (
            self.total_collateral
            + self.pool.total_gains
            + sum(self.surplus.values(), D(0))
            + self.default_collateral
        )
        if held < owed - eps:
            raise AssertionError(f"protocol holds {held:.6f} collateral, owes {owed:.6f}")

        for label, book in (("surplus", self.surplus), ("FUSD", self.fusd)):
            for who, amount in book.items():
                if amount < -eps:
                    raise AssertionError(f"negative {label} for {who}: {amount}")
        for who, amount in self.pool.deposits.items():
            if amount < -eps:
                raise AssertionError(f"negative pool deposit for {who}: {amount}")
        for who, amount in self.pool.gains.items():
            if amount < -eps:
                raise AssertionError(f"negative pool gain for {who}: {amount}")
        for who, amount in self.token.balances.items():
            if amount < -eps:
                raise AssertionError(f"negative token balance for {who}: {amount}")
        if self.bad_debt < -eps or self.default_collateral < -eps:
            raise AssertionError("negative default accounting")

        for owner, t in self.troves.items():
            if t.debt < 0 or t.collateral < 0:
                raise AssertionError(f"{owner} has negative balances: {t}")
