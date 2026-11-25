Risk disclosure
===============

Dependencies
------------

* Oracles: Chainlink for collateral pricing
* Collateral assets: SPY Stock Token on Robinhood Chain backing for FUSD

Chain Risk
----------

* Deployment chain: Robinhood Mainnet
* Cross-chain: none

Smart Contract Risks
--------------------

Florin has no manual pause, freeze, or shutdown functions. However, the protocol is capable of initiating an automatic shutdown of a borrow market in case of an extreme price drop of the respective collateral asset leading to insufficient collateralization, or an oracle failure of that particular collateral asset. Governance are able to add extra collateral branches while the protocol is running.

* See our audits for more information:
* Pause function: none
* Protocol freeze function: none
* Protocol shutdown function: Yes, it would be algorithmically targeted towards a specific branch
* FUSD whitelist or blacklist: none
* FUSD transfer freeze functionality: none

Collateral Risk
---------------

* Collaterals assets accepted: SPY only
* Collaterals assets accepted within the protocol are upgradeable and can be changed by governance

**What’s the shared-collateral risks?**

Each supported collateral asset constitutes an individual borrow market with its own group of borrowers and a separate Stability Pool backing their debts. This separation impacts user groups differently:

* Borrowers: Collateral risk is limited to the collateral asset held by the borrower. A borrower isn’t negatively affected by a failure of another collateral asset.
* FUSD Holders: As a multi-collateral stablecoin, FUSD is reliant on effective liquidations of undercollateralized loans in every borrow market to remain overcollateralized. Holders are subject to the risks of all supported collateral assets.
* Earners: SP depositors only get exposure to the asset they have opted for. However, as FUSD holders, they are similarly affected by potential depegging.

**Are there any safety mechanisms in place for potential de-pegs of the underlying collateral asset?**

The protocol aims to protect each borrow market from becoming undercollateralized by throttling debt creation and collateral withdrawal in unhealthy markets and by shutting down the entire market as a last resort. There are two safety thresholds:

* Critical Threshold (CT): If the TCR of a borrow market falls below the CT (e.g., 150%), new debt creation is prohibited. Collateral withdrawal is allowed as long as it goes along with a debt repayment greater than or equal to the collateral withdrawn.
* Shutdown Threshold (ST): If the TCR drops below the ST (e.g., 110%), the protocol triggers the shutdown of the borrow market and disables all borrowing operations except for closing Troves. Users can redeem FUSD against the respective collateral at a more favorable exchange rate than the current oracle price.

Oracle Risk
-----------

If Chainlink oracles fail, collateral markets might get priced inaccurately, leading to unfavorable redemptions or excessive or delayed liquidations. Oracle staleness could also cause problems by using out-of-date prices during shutdowns, leading to improper liquidations or redemptions.

**Mitigation:**

* The system shuts down a branch if the Robinhood Chain sequencer liveliness aggregator provided by Chainlink is reported as having an outage for longer than 24 hours.
* Upon shutdown, redemptions use the last recorded price, limiting the time window for exploiters to take advantage of a stale oracle.

Infrastructure Risk
-------------------

* Onchain infrastructure: Robinhood Chain sequencer outages.
* Open-source and publicly accessible off-chain infrastructure provided by Fluidity Labs.

Governance and Economic Risk
----------------------------

* Core protocol: is partially immutable - existing deployments cannot be changed
* Upgradable code: none
* Upgradable parameters: holiday parameters and additional collateral branches can be added
* Timelocks: governance execution in the first form

**Bad Debt mitigation and Branch Shutdown:**

In extreme cases, such as a severe drop in collateral value or failure of a supported collateral, the system may become undercollateralized. This could lead to the shutdown of a specific collateral branch or market, and the remaining debt could become "bad debt"—unbacked by sufficient collateral. This could in the worst case lead to bank runs: a portion of the system debt can not be cleared, and hence a portion of the FUSD supply can never be redeemed.

**Mitigation:**

Florin has built-in shutdown thresholds. When a collateral market's total collateral ratio (TCR) falls below the *Critical Threshold (CT)*, debt creation is paused, and collateral withdrawals are restricted. If the TCR drops further to the *Shutdown Threshold (ST)*, the protocol shuts down the market, freezes new borrowing, and triggers urgent redemptions. These redemptions are designed to clear as much debt as possible by allowing users to redeem FUSD at favorable rates.

Additionally, redemptions are split in proportion to the "outside" portion of the respective debt, which is defined as the total debt borrowed against a certain collateral minus the size of the SP of the respective borrowing market.

That way, redemptions primarily reduce the debt of the borrowing market with the lowest SP backing, reducing the risks that the market ever drops below the thresholds. This triggers the liquidation of all collateral within that market to buy back and burn as much FUSD as possible. However, if the collateral price crash is severe, some portion of FUSD may become unbacked.

If this unbacked portion is small, the system can still function with FUSD retaining its peg, assuming no major loss of confidence. However, if confidence erodes, FUSD may depeg, leading to mass redemptions across healthier markets. In the worst-case scenario, the remaining debt-backed FUSD supply could be fully redeemed, leaving only the unbacked portion, potentially reducing FUSD's value to zero.This could happen even if the failed collateral represented a small portion of the entire market. The outcome ultimately depends on the market’s confidence in FUSD and the system’s ability to mitigate further risks.

Liquidity Risk
--------------

Florin operates a single borrow market, backed by the SPY Stock Token. The SPY market features a stability pool, user-set interest rates, and individual Loan-to-Value (LTV) ratios tailored for the SPY asset. This market structure allows for precise risk management, ensuring that liquidations and redistributions occur independently within each collateral market.

To support the stability of FUSD, Florin uses borrower-paid interest to create demand and facilitate liquidations. Borrower interest is directed into two primary venues:

1. Stability Pool (75%): Each borrow market is linked to a corresponding Stability Pool, where 75% of the interest paid by borrowers is deposited. FUSD depositors in the Stability Pool earn a portion of this interest, along with liquidation gains in the respective collateral asset. This structure helps maintain liquidity and solvency in each borrow market by absorbing liquidation events.

   Potential risk:

   There's no guarantee that the liquidation gains are actually gains. In the worst case, e.g. when the oracle lags behind or an LST flash-crashes within a few blocks, the gains could turn into losses.

2. Protocol-Incentivized Liquidity (25%): The remaining 25% of interest goes to liquidity providers (LPs) as incentives, with the allocation split determined through weekly gauge voting. This incentivizes liquidity on decentralized exchanges, enhancing overall protocol stability and FUSD liquidity.

**Redemption mechanism and risk for FUSD Stability**

To prevent FUSD from falling below $1, Florin includes a redemption mechanism. Any FUSD holder can redeem 1 FUSD for $1 worth of collateral, ensuring that FUSD remains pegged to its intended value. Redemptions are prioritized by the lowest interest rate Troves first, allowing borrowers to maintain their positions while keeping the system balanced. Importantly, redemptions do not result in a net loss for borrowers but ensure the peg remains intact.

**Liquidation Process**

In the event of liquidations, the system first looks to the Stability Pool associated with the liquidated collateral type. If the Pool contains sufficient FUSD, it burns an amount equivalent to the borrower’s debt and redistributes the borrower’s collateral (105% of the debt) to the Pool’s depositors. These depositors receive both collateral and debt shares, proportional to their deposits.

If the Stability Pool is depleted and cannot cover the entire debt, the system falls back on two other liquidation modes:

* Just-in-Time (JIT) Liquidation: A liquidator deposits the amount of FUSD needed to cover the remaining debt directly into the Stability Pool, immediately triggering liquidation in exchange for 105% of the nominal debt in the collateral asset.
* Redistribution Mode: If JIT liquidation is not chosen, the entire debt and 110% of it in collateral is redistributed to fellow borrowers who hold the same type of collateral. Their debt increases proportionally, but they also receive a share of the liquidated collateral, ensuring system-wide balance.

This multi-layered liquidation process ensures that each collateral market is isolated from the others, minimizing systemic risk and allowing users to manage their positions independently.

MEV Risks
---------

**Frontrunning risk**

Borrowers may attempt to evade redemptions by either adjusting their Trove’s interest rate or closing and reopening their Trove. This "frontrunning" could occur when the FUSD price falls below $1, as savvy borrowers try to protect their positions from redemptions that would otherwise target them based on their user-set interest rates.

**Mitigation:**

Two fees are applied to disincentivize this behavior:

1. Upfront Borrowing Fee: Charged when a borrower opens a Trove or increases its debt, this fee is calculated as 7 days’ worth of average interest on the respective collateral branch. By applying this fee, borrowers are discouraged from continually closing and reopening Troves to evade redemptions, as it increases the cost of frequent adjustments.
2. Premature Adjustment Fee: When a borrower changes their interest rate too soon after the last adjustment (within a predefined cooldown period), they incur an additional opening fee. This mechanism prevents borrowers from rapidly adjusting their rates to avoid being prioritized in redemption processes, especially when rates are moving toward their redemption thresholds.

These measures help ensure that borrowers cannot easily front-run system redemptions.

**Flash Loans risk**

In Florin, redemption routing reduces the outside debt of each collateral branch proportionally. Flash loans could allow attackers to temporarily deposit FUSD into Stability Pools (SPs) of branches they wish to avoid, redirecting redemptions toward more favorable collateral branches. This could lead to arbitrage opportunities where the attacker selects assets with lower slippage on external markets.

However, while this strategy might increase profits for the attacker, it does not extract direct value from the protocol or impact the overall system health. The protocol’s design, with competitive redemption fees and the use of flash loan fees, naturally mitigates the risks associated with this manipulation. Flash loan fees reduce the profitability of such actions, and the competitive nature of redemption arbitrage further limits the potential benefits.

Mitigation: No fix is required because the risks are contained by the high costs of flash loans and the minimal impact on the protocol’s stability. Redemption routing is a soft measure designed to nudge the system toward balance, and the protocol remains reliant on the broader health of all collateral markets. Therefore, the system’s resilience is maintained despite these isolated arbitrage opportunities.

NFT loan transfer risk
----------------------

Troves are now represented as NFTs, enabling improved transferability and management of positions while maintaining the core stability mechanisms of the protocol. Troves are meant to be transferred between different owner accounts (e.g. hot and cold wallets), however, trading them in a marketplace poses additional risks. For example, Trove delegations and management accounts are not cleared after a transfer, the trove owner is able to reduce the trove's collateral before a trade, among other adversarial scenarios that could be used by malicious sellers on marketplaces.
