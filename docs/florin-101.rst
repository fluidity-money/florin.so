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

Florin US Dollars (FUSD) are algorithmically pegged to the US dollar stablecoins that are created in exchange for SPY token collateral. The SPY token is a tokenised S&P500

For example:
^^^^^^^^^^^^

Erik goes to borrow *$1500* with *3 SPY* tokens. Each SPY token is worth *$705* compared to the
USD, making the amount provided by Erik to collateralise the loan worth *$2115*.

He receives *1500 FUSD*, and owes *$1500* worth of SPY to pay his debt to the platform.
Erik chooses to borrow with *2.25%* as the annual fee he must pay in additional interest
payments added to his debt amount. Erik, because of the ratio of *$2115/$1500*, has a
collateral ratio of *1.41*.

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

Erik has the opportunity to pay that amount back at any point to close the loan. His debt
is owed denominated in the amount that he borrowed at the beginning of the loan and any
extra FUSD borrowed in the ongoing loan. He can update at the loan at any time to increase
the amount he borrowed, or to make partial payments.

Erik's collateral ratio at the time of opening is 1.14, but if the collateral ratio goes
below 1.10, the minimum, he's at risk of having his collateral taken from him! Let's do an
experiment:
