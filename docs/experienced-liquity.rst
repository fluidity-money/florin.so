Experienced with Liquity
========================

How does Florin differ from Liquity?
------------------------------------

Florin differs from Liquity in the following ways:

1. Minting and redemptions are not possible during holiday periods, corporate action periods, and weekends. This happens when the Stock Token is paused. See below for a UX breakdown of what's enabled and disabled during pause periods.

2. Chainlink liveliness checks only take place with a contract to check for sequencer outages.

3. Collateral branches can be added dynamically by governance.

4. Tokenised governance is not enabled at launch, instead supported by a multicall contract with timelock-based restrictions.

5. Periods when the token is expected to be paused can be configured by governance.

When do pause events happen?
----------------------------

Pauses happen during holiday periods, the weekend, and due to corporate actions including stock
splitting and dividend payments.

.. list-table:: Contract feature availability during pause events
	:header-rows: 1
	:widths: 55 45

	* - Operation
	  - Availability
	* - Opening a trove
	  - Disabled
	* - Adding collateral to a trove
	  - Enabled
	* - Withdrawing collateral
	  - Disabled
	* - Withdrawing FUSD
	  - Disabled
	* - Repaying FUSD
	  - Enabled
	* - Adjusting a trove
	  - Enabled only when collateral is increased and debt is not increased
	    (``_isCollIncrease && !_isDebtIncrease``).
	* - Adjusting a zombie trove
	  - Disabled
	* - Adjusting a trove's interest rate
	  - Enabled
	* - Closing a trove
	  - Enabled
	* - Applying pending debt
	  - Enabled
	* - Setting the batch manager's annual interest rate
	  - Enabled
	* - Setting the interest for a batch
	  - Enabled
	* - Removing a trove from a batch
	  - Enabled
	* - Switching a batch manager
	  - Enabled
	* - Batch liquidations
	  - Enabled
	* - Collateral redemptions
	  - Disabled
	* - Urgent redemptions
	  - Enabled
	* - Stability pool operations
	  - Enabled
