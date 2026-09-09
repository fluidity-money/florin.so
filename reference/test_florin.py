"""Invariant and behaviour tests. Run: python3 -m pytest test_florin.py -q"""
from decimal import Decimal as D
import pytest
from florin import (AmountError, Florin, Market, PoolError, PriceFeed, ProtocolError,
                    StabilityPool, StockToken, Trove, TroveError,
                    TransferBlocked, leverage_at, loop_rounds,
                    pay_dividend, time_to_liquidation)
from florin.core import SECONDS_PER_YEAR

YEAR = int(SECONDS_PER_YEAR)
EPS = D("0.000001")


def build(price="650"):
    token = StockToken()
    for w in ("alice", "bob", "carol"):
        token.mint(w, D("50"))
    feed = PriceFeed(token, share_price=D(price))
    return Florin(token=token, feed=feed), token, feed


# ---- core borrowing ------------------------------------------------------

def test_ltv_is_reciprocal_of_cr():
    m = Market()
    t = m.open_trove(collateral=D("4"), borrow=D("1000"), rate=D("0.06"), price=D("650"), now=0)
    assert abs(m.collateral_ratio(t, D("650"), YEAR) * m.ltv(t, D("650"), YEAR) - 1) < EPS

def test_interest_never_touches_collateral():
    m = Market()
    t = m.open_trove(collateral=D("4"), borrow=D("1000"), rate=D("0.06"), price=D("650"), now=0)
    after = m.accrue(t, YEAR)
    assert after.collateral == t.collateral
    assert after.debt > t.debt

def test_max_borrow_lands_on_mcr():
    m = Market()
    t = m.open_trove(collateral=D("4"), borrow=D("1000"), rate=D("0.06"), price=D("650"), now=0)
    draw = m.max_borrow(t, D("650"), 0)
    t2 = m.adjust(t, price=D("650"), now=0, debt_delta=draw)
    assert abs(m.collateral_ratio(t2, D("650"), 0) - m.params.mcr) < EPS
    with pytest.raises(TroveError):
        m.adjust(t, price=D("650"), now=0, debt_delta=draw + D("1"))

def test_liquidation_price_hits_mcr():
    m = Market()
    t = m.open_trove(collateral=D("4"), borrow=D("1000"), rate=D("0.06"), price=D("650"), now=0)
    lp = m.liquidation_price(t, 0)
    assert abs(m.collateral_ratio(t, lp, 0) - m.params.mcr) < EPS

def test_leverage_matches_summed_series():
    tot = sum(a for _, a, _ in loop_rounds(D("1000"), D("1.6"), rounds=300))
    assert abs(tot / D("1000") - leverage_at(D("1.6"))) < D("0.0001")

def test_undercollateralised_open_rejected():
    m = Market()
    with pytest.raises(TroveError):
        m.open_trove(collateral=D("1"), borrow=D("600"), rate=D("0.06"), price=D("650"), now=0)


# ---- the multiplier ------------------------------------------------------

def test_dividend_with_no_withholding_leaves_token_price_flat():
    _, token, feed = build()
    before = feed.latest()
    pay_dividend(feed, per_share=D("2.00"), withholding=D("0"))
    assert abs(feed.latest() - before) < EPS
    assert token.ui_multiplier > 1

def test_withholding_is_the_only_loss():
    _, token, feed = build()
    before = feed.latest()
    pay_dividend(feed, per_share=D("2.00"), withholding=D("0.30"))
    assert abs((before - feed.latest()) - D("0.60")) < EPS

def test_double_counting_the_multiplier_overstates_collateral():
    """The documented footgun, quantified."""
    f, token, feed = build()
    f.open_trove("alice", collateral=D("10"), borrow=D("2000"), rate=D("0.06"), wall=0)
    for _ in range(4):
        pay_dividend(feed, per_share=D("2.00"), withholding=D("0"))
    t = f.troves["alice"]
    correct = f.market.collateral_value(t, f.price())
    buggy = t.collateral * token.ui_multiplier * f.price()
    assert buggy > correct
    assert abs(buggy / correct - token.ui_multiplier) < EPS


# ---- protocol ------------------------------------------------------------

def test_supply_equals_debt_through_full_lifecycle():
    f, token, feed = build()
    f.open_trove("alice", collateral=D("6"), borrow=D("2000"), rate=D("0.05"), wall=0)
    f.open_trove("bob", collateral=D("5"), borrow=D("1500"), rate=D("0.09"), wall=0)
    f.check_invariants()
    f.accrue_all(YEAR); f.check_invariants()
    f.deposit_pool("bob", D("1000"), wall=YEAR)
    f.accrue_all(2 * YEAR); f.check_invariants()
    feed.move(D("-0.30")); f.liquidate_all(2 * YEAR); f.check_invariants()

def test_redemption_hits_the_cheapest_rate_first():
    f, token, feed = build()
    f.open_trove("alice", collateral=D("6"), borrow=D("2000"), rate=D("0.09"), wall=0)
    f.open_trove("bob", collateral=D("6"), borrow=D("2000"), rate=D("0.03"), wall=0)
    f._debit("alice", D("500")); f._credit("arb", D("500"))
    assert f.redeem("arb", D("500"), 0)["troves_hit"] == ["bob"]

def test_redemption_improves_the_ratio_it_hits():
    f, token, feed = build()
    f.open_trove("alice", collateral=D("6"), borrow=D("2000"), rate=D("0.03"), wall=0)
    before = f.market.collateral_ratio(f.troves["alice"], f.price(), 0)
    f._debit("alice", D("500")); f._credit("arb", D("500"))
    f.redeem("arb", D("500"), 0)
    assert f.market.collateral_ratio(f.troves["alice"], f.price(), 0) > before

def test_healthy_troves_cannot_be_liquidated():
    f, _, _ = build()
    f.open_trove("alice", collateral=D("6"), borrow=D("2000"), rate=D("0.05"), wall=0)
    with pytest.raises(ProtocolError):
        f.liquidate("alice", 0)

def test_shortfall_redistributes_to_survivors():
    f, token, feed = build()
    f.open_trove("alice", collateral=D("6"), borrow=D("2200"), rate=D("0.05"), wall=0)
    f.open_trove("bob", collateral=D("20"), borrow=D("2000"), rate=D("0.09"), wall=0)
    bob_debt = f.troves["bob"].debt
    feed.move(D("-0.35"))
    res = f.liquidate("alice", 0)
    assert res["redistributed"] > 0          # empty pool, so all of it
    assert f.troves["bob"].debt > bob_debt   # survivor absorbed it
    f.check_invariants()


# ---- the pause -----------------------------------------------------------

def test_pause_stops_the_interest_clock():
    f, token, feed = build()
    f.open_trove("alice", collateral=D("6"), borrow=D("2000"), rate=D("0.10"), wall=0)
    f.pause(YEAR)
    frozen = f.market.debt_at(f.troves["alice"], f.clock.now(YEAR))
    assert f.market.debt_at(f.troves["alice"], f.clock.now(3 * YEAR)) == frozen
    f.unpause(3 * YEAR)
    assert f.market.debt_at(f.troves["alice"], f.clock.now(4 * YEAR)) > frozen

def test_pause_suspends_liquidation_and_redemption():
    f, token, feed = build()
    f.open_trove("alice", collateral=D("6"), borrow=D("2200"), rate=D("0.05"), wall=0)
    feed.move(D("-0.35"))
    f.pause(0)
    with pytest.raises(ProtocolError):
        f.liquidate("alice", 0)
    with pytest.raises(ProtocolError):
        f.redeem("alice", D("100"), 0)

def test_blocklisted_address_cannot_open():
    f, token, _ = build()
    token.block("alice")
    with pytest.raises(TransferBlocked):
        f.open_trove("alice", collateral=D("6"), borrow=D("2000"), rate=D("0.05"), wall=0)


# ---- helpers -------------------------------------------------------------

def test_time_to_liquidation_matches_the_doc():
    assert abs(time_to_liquidation(D("1.60"), D("0.06")) - D("2.3")) < D("0.1")
    assert time_to_liquidation(D("1.60"), D("0.06"), D("0.08")) == D("Infinity")


# ==========================================================================
# regressions from the external review
# ==========================================================================

def _two_troves(price="100"):
    token = StockToken()
    feed = PriceFeed(token, D(price))
    f = Florin(token, feed)
    for who, coll, rate in (("alice", "20", "0.10"), ("bob", "50", "0.15")):
        token.mint(who, D(coll))
        f.open_trove(who, collateral=D(coll), borrow=D("1000"), rate=D(rate), wall=0)
    return f, token, feed


def test_rejected_operation_rolls_back_completely():
    """#1 Python has no revert; _atomic stands in for it."""
    from copy import deepcopy
    f, _, _ = _two_troves()
    f._debit("alice", D("1000")); f._credit("arb", D("1000"))
    before = deepcopy(f)
    with pytest.raises(ProtocolError):
        f.adjust_trove("alice", wall=0, debt_delta=D("-300"))
    assert f == before


def test_failed_close_while_paused_does_not_burn_fusd():
    """#1 the FUSD must not vanish when the collateral transfer is refused."""
    f, token, _ = _two_troves()
    token.pause()
    held = f.balance("alice")
    with pytest.raises(ProtocolError):
        f.close_trove("alice", 0)
    assert f.balance("alice") == held
    assert "alice" in f.troves
    f.check_invariants()


def test_redemption_never_spends_more_than_offered():
    """#2 dust handling used to override the caller's budget."""
    f, _, _ = _two_troves()
    f._debit("alice", D("900")); f._credit("arb", D("900"))
    f._debit("bob", D("200")); f._credit("arb", D("200"))
    r = f.redeem("arb", D("900"), 0)
    assert r["burned"] <= D("900")
    assert r["unfilled"] >= 0
    f.check_invariants()


def test_redemption_leaves_the_minimum_debt_intact():
    """#2 a truncated partial redemption must not create dust."""
    f, _, _ = _two_troves()
    f._debit("alice", D("900")); f._credit("arb", D("900"))
    f.redeem("arb", D("900"), 0)
    for t in f.troves.values():
        assert t.debt == 0 or t.debt >= f.market.params.min_debt


def test_insolvent_troves_are_skipped_by_redemption():
    """#3 redeeming below the MCR would spend other borrowers' collateral."""
    f, _, feed = _two_troves()
    feed.set_share_price(D("40"))  # alice is now deeply underwater
    assert f.market.collateral_ratio(f.troves["alice"], f.price(), 0) < 1
    f._debit("bob", D("1000")); f._credit("arb", D("1000"))
    r = f.redeem("arb", D("1000"), 0)
    assert "alice" not in r["troves_hit"]
    assert all(v >= 0 for v in f.surplus.values())
    f.check_invariants()


def test_invariants_catch_a_negative_surplus():
    """#3 supply == debt alone did not prove adequate backing."""
    f, _, _ = _two_troves()
    f.surplus["alice"] = D("-1")
    with pytest.raises(AssertionError):
        f.check_invariants()


def test_late_pool_joiner_cannot_capture_past_interest():
    """#4 deposit_pool settles outstanding interest before membership changes."""
    f, _, _ = _two_troves()
    f._debit("alice", D("1")); f._credit("late", D("1"))
    f.deposit_pool("late", D("1"), wall=YEAR)  # a year of interest is outstanding
    assert f.pool.deposit_of("late") == D("1")
    f.accrue_all(YEAR)
    assert f.pool.deposit_of("late") == D("1")


def test_raw_pool_membership_is_closed():
    """#4 the untimed back door must fail loudly, not silently mis-allocate."""
    f, _, _ = _two_troves()
    with pytest.raises(PoolError):
        f.pool.deposit("late", D("1"))
    with pytest.raises(PoolError):
        f.pool.withdraw("late", D("1"))


def test_paused_protocol_refuses_new_borrowing():
    """#5 minting touches no collateral, so it slipped past the token pause."""
    f, _, _ = _two_troves()
    f.pause(0)
    with pytest.raises(ProtocolError):
        f.adjust_trove("alice", wall=0, debt_delta=D("100"))
    with pytest.raises(ProtocolError):
        f.open_trove("carol", collateral=D("5"), borrow=D("200"), rate=D("0.05"), wall=0)


def test_paused_protocol_still_allows_repayment():
    """#5 stated policy: deleveraging stays open during a freeze."""
    f, _, _ = _two_troves()
    f.pause(0)
    before = f.troves["alice"].debt
    f.adjust_trove("alice", wall=0, debt_delta=D("-300"))
    assert f.troves["alice"].debt < before
    f.check_invariants()


def test_direct_token_pause_freezes_the_clock():
    """#5 a pause applied straight to the token is still honoured."""
    f, token, _ = _two_troves()
    token.pause()
    before = f.total_debt
    f.accrue_all(YEAR)
    assert f.total_debt == before


def test_default_collateral_stays_on_the_books():
    """#6 seized collateral with no survivor to hold it was being dropped."""
    token = StockToken(); token.mint("alice", D("20"))
    feed = PriceFeed(token, D("100"))
    f = Florin(token, feed)
    f.open_trove("alice", collateral=D("20"), borrow=D("1000"), rate=D("0.05"), wall=0)
    feed.set_share_price(D("60"))
    f.liquidate("alice", 0)
    assert f.default_collateral == D("20")
    assert f.bad_debt > 0
    f.check_invariants()


def test_negative_amounts_are_rejected():
    """#7 signed arithmetic fabricated balances from a negative quantity."""
    from florin import AmountError
    p = StabilityPool()
    with pytest.raises(AmountError):
        p.withdraw("x", D("-100"))
    assert p.deposit_of("x") == 0

    token = StockToken(); token.mint("a", D("10"))
    with pytest.raises(AmountError):
        token.transfer("a", "b", D("-10"))
    assert token.balance_of("a") == D("10") and token.balance_of("b") == 0


def test_backward_time_is_rejected_not_double_charged():
    """#8 rewinding last_update let the same year be charged twice."""
    f, _, _ = _two_troves()
    f.accrue_all(YEAR)
    after_one_year = f.total_debt
    with pytest.raises(ProtocolError):
        f.accrue_all(0)
    assert f.total_debt == after_one_year
    f.accrue_all(YEAR)
    assert f.total_debt == after_one_year


def test_split_is_value_neutral():
    """Reviewer note: a split must move the multiplier and the price together."""
    from florin import apply_split
    token = StockToken(); token.mint("a", D("10"))
    feed = PriceFeed(token, D("100"))
    before = token.balance_of("a") * feed.latest()
    apply_split(feed, D("2"))
    assert abs(token.balance_of("a") * feed.latest() - before) < EPS


# ==========================================================================
# regressions from the follow-up review
# ==========================================================================

def test_direct_pause_then_protocol_unpause_excludes_the_frozen_span():
    """F1 unpause cleared the flag before syncing, so the clock never froze."""
    f, token, _ = _two_troves()
    token.pause()                      # issuer acts directly, no timestamp
    f.unpause(YEAR)
    before = f.total_debt
    f.accrue_all(YEAR)
    assert f.total_debt == before


def test_backdated_unpause_is_rejected():
    """F2a pause(YEAR) then unpause(0) used to re-charge the whole year."""
    f, _, _ = _two_troves()
    f.pause(YEAR)
    after_pause = f.total_debt
    with pytest.raises(ProtocolError):
        f.unpause(0)
    f.accrue_all(YEAR)
    assert f.total_debt == after_pause


def test_backdated_event_while_frozen_is_rejected():
    """F2b the event watermark must advance during a freeze too."""
    f, _, _ = _two_troves()
    f.pause(0)
    f.accrue_all(2 * YEAR)
    with pytest.raises(ProtocolError):
        f.deposit_pool("alice", D("100"), YEAR)


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), 1.5, True, -1])
def test_invalid_wall_time_is_rejected(bad):
    """F3 a NaN timestamp passed monotonicity, poisoned last_update, and
    silenced interest permanently."""
    f, _, _ = _two_troves()
    with pytest.raises((AmountError, ProtocolError)):
        f.accrue_all(bad)
    f.accrue_all(YEAR)
    assert f.total_debt > D("2010")  # interest still accrues normally


@pytest.mark.parametrize("move", [D("Infinity"), D("-1"), D("-2")])
def test_invalid_price_move_is_rejected_without_mutation(move):
    """F4 move() assigned directly, bypassing the positive-finite guard."""
    f, _, feed = _two_troves()
    before = feed.share_price
    with pytest.raises(AmountError):
        feed.move(move)
    assert feed.share_price == before


def test_rejected_sweep_rolls_back():
    """F5 the module claims every public mutator is atomic; it now is."""
    from copy import deepcopy
    f, _, _ = _two_troves()
    before = deepcopy(f)
    with pytest.raises(ProtocolError):
        f.liquidate_all(YEAR, max_passes=1.5)
    assert f == before


def test_underwater_trove_can_still_be_rescued():
    """A borrower below the MCR must be able to repay or top up.

    The old rule refused any adjustment leaving CR under the floor, which
    blocked exactly the actions that save a position.
    """
    f, token, feed = _two_troves()
    feed.set_share_price(D("60"))
    cr0 = f.market.collateral_ratio(f.troves["alice"], f.price(), 0)
    assert cr0 < f.market.params.mcr
    f.adjust_trove("alice", wall=0, debt_delta=D("-100"))   # repay
    cr1 = f.market.collateral_ratio(f.troves["alice"], f.price(), 0)
    assert cr1 > cr0
    with pytest.raises(TroveError):                          # but not worsen
        f.adjust_trove("alice", wall=0, debt_delta=D("100"))


def test_paused_repayment_cannot_also_reprice():
    """Repricing moves the trove in the redemption queue: not deleveraging."""
    f, _, _ = _two_troves()
    f.pause(0)
    with pytest.raises(ProtocolError):
        f.adjust_trove("alice", wall=0, debt_delta=D("-100"), new_rate=D("0.02"))


def test_tcr_covers_the_live_book_and_solvency_covers_everything():
    """Mixing bad_debt into the numerator-free side measured two things."""
    token = StockToken(); token.mint("alice", D("20"))
    feed = PriceFeed(token, D("100"))
    f = Florin(token, feed)
    f.open_trove("alice", collateral=D("20"), borrow=D("1000"), rate=D("0.05"), wall=0)
    feed.set_share_price(D("60"))
    f.liquidate("alice", 0)
    assert f.total_collateral_ratio() == D("Infinity")   # no live troves left
    assert f.system_solvency() > 1                        # 20 x 60 against 1005
    f.check_invariants()


def test_rescue_mode_refuses_mixed_adjustments_that_grow_exposure():
    """"Improves the ratio" alone licenses borrowing against a big deposit,
    and withdrawal against a big repayment. Both grow a sick trove."""
    f, token, feed = _two_troves()
    token.mint("alice", D("100"))
    feed.set_share_price(D("60"))
    assert f.market.collateral_ratio(f.troves["alice"], f.price(), 0) < f.market.params.mcr

    # Depositing 3 while drawing 100 lifts CR from 119.4% to 124.8%: better,
    # still under the floor, and 100 of fresh debt on a sick trove.
    with pytest.raises(TroveError):
        f.adjust_trove("alice", wall=0, collateral_delta=D("3"), debt_delta=D("100"))
    # Repaying 200 while pulling 2 tokens lifts CR from 119.4% to 134.2%:
    # better, still under the floor, and 120 of collateral walked out.
    with pytest.raises(TroveError):
        f.adjust_trove("alice", wall=0, collateral_delta=D("-2"), debt_delta=D("-200"))

    f.adjust_trove("alice", wall=0, collateral_delta=D("5"))      # deposit: allowed
    f.adjust_trove("alice", wall=0, debt_delta=D("-100"))         # repay: allowed
    f.check_invariants()


def test_managed_pool_claim_is_closed_and_the_wrapper_transfers():
    """Readiness #1: raw claim zeroed the entitlement without moving tokens."""
    f, token, feed = _two_troves()
    f.deposit_pool("bob", D("1000"), wall=0)
    feed.set_share_price(D("60"))
    f.liquidate("alice", 0)
    assert f.pool.gain_of("bob") > 0

    with pytest.raises(PoolError):
        f.pool.claim("bob")
    assert f.pool.gain_of("bob") > 0          # entitlement intact

    before = token.balance_of("bob")
    won = f.claim_pool_gains("bob")
    assert won > 0 and token.balance_of("bob") == before + won
    f.check_invariants()


def test_standalone_market_guards_its_own_inputs():
    """Readiness #3: Market is a public boundary, not a trusted inner layer."""
    m = Market()
    t = m.open_trove(collateral=D("4"), borrow=D("1000"), rate=D("0.06"),
                     price=D("650"), now=0)
    with pytest.raises(AmountError):
        m.adjust(t, price=D("650"), now=0, collateral_delta=D("Infinity"))
    with pytest.raises(AmountError):
        m.accrue(t, float("nan"))
    with pytest.raises(AmountError):
        m.open_trove(collateral=D("4"), borrow=D("1000"), rate=D("0.06"),
                     price=D("-650"), now=0)


def test_extreme_split_commits_both_sides_or_neither():
    """Readiness #4: a ratio that overflows the division left a torn state."""
    from florin import apply_split
    token = StockToken(); token.mint("a", D("10"))
    feed = PriceFeed(token, D("100"))
    mult, price = token.ui_multiplier, feed.share_price
    with pytest.raises(Exception):
        apply_split(feed, D("1e-999999"))
    assert token.ui_multiplier == mult and feed.share_price == price
