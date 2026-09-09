# Florin

A reference implementation of a CDP lending market for tokenized stocks on
Robinhood Chain. Deposit SPY as collateral, mint FUSD against it, borrow
dollars without selling a share.

`Decimal` throughout, never float. Self-contained and independent of the
site: pure Python with no dependencies beyond the standard library, and
nothing here is imported by the Next.js app.

## Run it

```bash
cd reference
python3 -m florin.demo     # seven-act end-to-end scenario
python3 -m florin.core     # borrowing mechanics on their own
python3 stress.py          # 40 seeds x 250 actions, invariants and rollback
```

Tests need pytest, which is the only dependency and only for the suite:

```bash
python3 -m venv .venv && .venv/bin/pip install pytest
.venv/bin/python -m pytest test_florin.py -q    # 52 tests
```

## Layout

| Module | Contents |
|---|---|
| `core.py` | `Trove`, `Market`. Borrowing, interest accrual, CR/LTV, leverage helpers. |
| `collateral.py` | `StockToken`, `PriceFeed`. The multiplier, pause, blocklist, dividends. |
| `pool.py` | `StabilityPool`. Deposits, liquidation absorption, interest share. |
| `protocol.py` | `Florin`. Interest routing, liquidation, redemption, the pause clock. |
| `demo.py` | A seven-act scenario, invariants checked after each. |
| `guards.py` | Input validation at every public boundary. |
| `stress.py` | Randomised lifecycle harness over 40 seeds. |

`Trove` is a dumb record and `Market` holds the logic, mirroring how the
Solidity will split into a struct and a TroveManager.

## Three things to know before editing

**Collateral value is `balanceOf × price` and nothing else.** The Chainlink
feed for a Robinhood Chain stock token already includes `uiMultiplier()`.
Applying it a second time overstates every position by the accrued dividend
factor: an error that is exactly zero on day one and compounds silently for
years. `Market.collateral_value` is a one-line method specifically so this
has somewhere to be written down.

**Interest accrues to debt, never to collateral.** It is a growing lien
settled only on close, adjust, or liquidation. Nothing is deducted from the
collateral balance, ever.

**FUSD supply always equals total debt**, where total debt is live trove
debt *plus* `bad_debt`. Every mint has a matching debt increase, including
the origination fee and accrued interest, and a defaulted position keeps its
debt on the books because the FUSD it created still exists. That is the first
assertion in `Florin.check_invariants`, and it is what catches accounting
mistakes. Note it is necessary but not sufficient: a negative balance
somewhere offsets the total and hides a shortfall, so every balance is also
asserted non-negative in its own right.

**Two timestamps, two questions.** `_last_event` is the newest wall time any
timed mutation has been accepted at, and it advances even while frozen, so a
pause is not a window in which history can be rewritten. `_last_live` is the
newest time the token was seen unpaused, and it is where the clock stops when
a pause is discovered after the fact.

## Design choices that are ours, not Liquity's

**140% minimum collateral ratio**, not 110%. The binding risk is a quoting
gap during stress rather than a technical one.

**The pause clock.** The collateral can be frozen by its issuer at any time:
the deployed token is a beacon proxy exposing `pause`, `unpause`, `paused`
and `isBlocked`. When that happens Florin freezes with it, and the interest
clock stops, so borrowers are not charged for a freeze they cannot escape.
Liquidations and redemptions suspend symmetrically. See `protocol.Clock`.

**Underwater troves can still be rescued.** Below the floor a trove enters
rescue mode: it accepts collateral deposits and debt repayments that strictly
improve the ratio, and nothing else. No withdrawals, no fresh borrowing.
"Improves the ratio" alone would be too permissive, since a large enough
deposit licenses new debt and a large enough repayment licenses a withdrawal,
both growing exposure on a sick position. Refusing rescue outright is worse
still: it forces liquidation on exactly the person trying to prevent it.

**Two coverage metrics, not one.** `total_collateral_ratio` measures the live
book. `system_solvency` measures collateral allocated to outstanding FUSD
debt at the modelled price, defaults included on both sides. Neither is
market solvency: they say nothing about executable liquidation value, and
supply/debt equality is not a peg guarantee. Pool gains and borrower surplus
are excluded from `system_solvency` because they are owed to specific people
rather than backing FUSD.

**Liquidation sweeps repeatedly.** Redistribution loads debt onto survivors
and can push a trove that was healthy at the start of a sweep underwater by
the end. `liquidate_all` iterates until the book is stable, so the cascade
is modelled rather than hidden. The demo shows it: three troves liquidate
where only two were underwater to begin with.

## Not implemented

Governance, an incentivised liquidity layer, multi-collateral branches, and
position NFTs. The last of those is discussed in `florin-mechanics.html`;
short version, use plain ERC-721 rather than ERC-6551.
