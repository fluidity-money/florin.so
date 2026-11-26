Florin 101
==========

Florin is a protocol deployed to Robinhood Chain that facilitates the borrowing of Florin
USD in exchange for the Robinhood SPY Stock Token.

What's Robinhood Chain?
-----------------------

Robinhood Chain is an Arbitrum-based blockchain. Arbitrum is the leading blockchain
technology for financial application smart contracts, and at the time of writing has
$2.227 USD billion worth of value deployed across a plethora of smart contracts on various
chains Arbitrum runs, including Robinhood Chain.

Robinhood Chain is run by Robinhood the company, and it has stocks converted to Stock
Tokens, a superset of the ERC20 token with features supporting rebasing for stock
splitting and dividend payments.

Florin is a smart contract deployed to Robinhood Chain. A website has been built that lets
you connect to the smart contract, and the website runs at https://florin.so.

What are Florin US Dollars (FUSD)?
----------------------------------

Florin US Dollars (FUSD) are stablecoins pegged to the US dollar, and are created in exchange for
the SPY token, a tokenised S&P 500 share token. $1 of FUSD represents $1 of SPY debt that
was provided by a borrower. The system keeps the value of FUSD the same as the US dollar by
liquidating collateral provided by borrowers that fall below the 1.10% collateral to debt ratio.

For example:
^^^^^^^^^^^^

Erik goes to borrow *$1500* with *3 SPY* tokens. Each SPY token is worth *$705* compared
to the USD, making the amount provided by Erik to collateralise the loan worth *$2115*.
Erik chooses to borrow with *2.25%* as the annual fee he must pay in additional interest
payments added to his debt amount.

He receives *1500 FUSD* and owes that amount to the protocol to repay the loan. Erik,
because of the ratio of *$2115/$1500*, has a collateral ratio of *1.41*.

.. list-table::
	:widths: 65 35

	* - Amount borrowed
	  - $1500
	* - Amount of SPY collateral
	  - 3 SPY
	* - SPY collateral value
	  - $2115
	* - Collateral ratio
	  - 1.14

.. mermaid::

   flowchart TD
     Erik
     -->|"Supplying $2115 of SPY to borrow $200"| Florin
     -->|"Sends $1500 FUSD back"| Erik

Erik can go and do whatever he wants with the FUSD, but he must keep his ratio of
collateral to debt above the minimum, 1.10%. If he doesn't, then Florin will Liquidate
him, taking the collateral he put up to borrow FUSD, and burning the FUSD tokens equal to
what he borrowed. The FUSD that's burned comes from suppliers of FUSD to the Stability
Pool, who have selected to do so in exchange for a share of the collateral that's provided
as a fee.
