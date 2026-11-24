Developers
==========

Using the graph
---------------

Florin provides a graph endpoint that can be queried at
https://graph.superposition.so/robinhood-testnet/florin.

Asking for the ingestor status
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. raw:: html

	<div class="graph-example" data-graph-example>
		<div class="graph-example__explanation">
			<p>This is a checkpoint, not a guarantee that the ingestor is currently running or caught up with the chain. If the field is missing, the checkpoint is unavailable.</p>
		</div>
		<div class="graph-example__console">
			<label class="graph-example__label" for="ingestor-query">GraphQL query</label>
			<textarea id="ingestor-query" data-graph-query rows="7" spellcheck="false" autocapitalize="off" autocomplete="off">query IngestorStatus {
	  __typename
	}</textarea>
			<button type="button" data-graph-run>Run query</button>
			<p data-graph-status role="status" aria-live="polite">Click Run query to send a request to the testnet graph.</p>
			<pre class="graph-example__response" tabindex="0" aria-label="GraphQL response"><code data-graph-response>No request sent yet.</code></pre>
		</div>
	</div>

Reading borrowing totals
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. raw:: html

	<div class="graph-example" data-graph-example>
		<div class="graph-example__explanation">
			<p><code>borrowDetails</code> returns borrowing totals by collateral, with no arguments.</p><ul><li><code>collateral.name</code>: collateral name.</li><li><code>avgRatePa</code>: average annual borrowing rate.</li><li><code>deposited</code>: deposited collateral amount.</li><li><code>debtIssued</code>: issued debt amount.</li></ul><p>Amounts are raw 18-decimal integer strings. Percentages are display-ready strings; preserve these strings rather than converting raw amounts to JavaScript floating-point numbers.</p>
		</div>
		<div class="graph-example__console">
			<label class="graph-example__label" for="borrow-details-query">GraphQL query</label>
			<textarea id="borrow-details-query" data-graph-query rows="10" spellcheck="false" autocapitalize="off" autocomplete="off">query BorrowDetails {
	  borrowDetails {
	    collateral { name }
	    avgRatePa
	    deposited
	    debtIssued
	  }
	}</textarea>
			<button type="button" data-graph-run>Run query</button>
			<p data-graph-status role="status" aria-live="polite">Click Run query to send a request to the testnet graph.</p>
			<pre class="graph-example__response" tabindex="0" aria-label="GraphQL response"><code data-graph-response>No request sent yet.</code></pre>
		</div>
	</div>

Reading stability pool rewards
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. raw:: html

	<div class="graph-example" data-graph-example>
		<div class="graph-example__explanation">
			<p><code>earnRewards</code> returns stability pool reward metrics by collateral, with no arguments.</p><ul><li><code>collateral.name</code>: collateral name.</li><li><code>apr7dAvg</code>: average APR over the last seven days.</li><li><code>apr24hAvg</code>: average APR over the last 24 hours.</li><li><code>poolSize</code>: pool amount as a raw 18-decimal integer string.</li><li><code>coverage</code>: coverage percentage.</li></ul><p>APR and coverage values are display-ready percentage strings. Historical APR is not a promise of future returns.</p>
		</div>
		<div class="graph-example__console">
			<label class="graph-example__label" for="earn-rewards-query">GraphQL query</label>
			<textarea id="earn-rewards-query" data-graph-query rows="10" spellcheck="false" autocapitalize="off" autocomplete="off">query EarnRewards {
	  earnRewards {
	    collateral { name }
	    apr7dAvg
	    apr24hAvg
	    poolSize
	    coverage
	  }
	}</textarea>
			<button type="button" data-graph-run>Run query</button>
			<p data-graph-status role="status" aria-live="polite">Click Run query to send a request to the testnet graph.</p>
			<pre class="graph-example__response" tabindex="0" aria-label="GraphQL response"><code data-graph-response>No request sent yet.</code></pre>
		</div>
	</div>

Finding open positions for a wallet
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. raw:: html

	<div class="graph-example" data-graph-example>
		<div class="graph-example__explanation">
			<p><code>openPositions(owner: Address!)</code> returns the indexed open positions owned by a wallet.</p><p>Replace the zero-address placeholder in the editor with the wallet address you want to inspect. An empty list means no open positions were returned for that address.</p><ul><li><code>troveId</code> and <code>troveManager</code>: together identify the position.</li><li><code>owner</code>: position owner.</li><li><code>debt</code>, <code>collateral</code>, and <code>stake</code>: raw 18-decimal integer strings.</li><li><code>annualInterestRate</code>: display-ready annual interest percentage.</li><li><code>interestBatchManager</code>: nullable batch-manager address.</li></ul><p>Keep the trove ID as a string to avoid integer precision loss. Newly opened or changed positions may not appear until indexed.</p>
		</div>
		<div class="graph-example__console">
			<label class="graph-example__label" for="open-positions-query">GraphQL query</label>
			<textarea id="open-positions-query" data-graph-query rows="10" spellcheck="false" autocapitalize="off" autocomplete="off">query OpenPositions {
	  openPositions(owner: "0x0000000000000000000000000000000000000000") {
	    troveId
	    troveManager
	    owner
	    debt
	    collateral
	    stake
	    annualInterestRate
	    interestBatchManager
	  }
	}</textarea>
			<button type="button" data-graph-run>Run query</button>
			<p data-graph-status role="status" aria-live="polite">Click Run query to send a request to the testnet graph.</p>
			<pre class="graph-example__response" tabindex="0" aria-label="GraphQL response"><code data-graph-response>No request sent yet.</code></pre>
		</div>
	</div>

Reading stability pool APR history
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. raw:: html

	<div class="graph-example" data-graph-example>
		<div class="graph-example__explanation">
			<p><code>stabilityPoolApr</code> returns the SPY stability pool APR history for the last 30 days, with no arguments.</p><p>The result is a list of display-ready percentage strings, not objects, so this field has no nested selection set. The response does not include timestamps; do not infer date labels from the values alone.</p><p>Historical APR is not a guaranteed future yield.</p>
		</div>
		<div class="graph-example__console">
			<label class="graph-example__label" for="stability-pool-apr-query">GraphQL query</label>
			<textarea id="stability-pool-apr-query" data-graph-query rows="10" spellcheck="false" autocapitalize="off" autocomplete="off">query StabilityPoolApr {
	  stabilityPoolApr
	}</textarea>
			<button type="button" data-graph-run>Run query</button>
			<p data-graph-status role="status" aria-live="polite">Click Run query to send a request to the testnet graph.</p>
			<pre class="graph-example__response" tabindex="0" aria-label="GraphQL response"><code data-graph-response>No request sent yet.</code></pre>
		</div>
	</div>
