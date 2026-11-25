Developers
==========

Extra smart contract functions
-------------------------------


Using the graph
---------------

Florin provides a graph endpoint that can be queried at
https://graph.superposition.so/robinhood-testnet/florin.

All requests include the ingestor block height as an extension.

Reading borrowing totals
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. raw:: html

	<div class="graph-example" data-graph-example>
		<div class="graph-example__explanation">
			<p><code>borrowDetails</code> returns borrowing totals by collateral, with no arguments.</p><ul><li><code>collateral.name</code>: collateral name.</li><li><code>avgRatePa</code>: average annual borrowing rate.</li><li><code>deposited</code>: deposited collateral amount.</li><li><code>debtIssued</code>: issued debt amount.</li></ul><p>Amounts are raw 18-decimal integer strings. Percentages are display-ready strings; preserve these strings rather than converting raw amounts to JavaScript floating-point numbers.</p>
		</div>
		<div class="graph-example__console">
			<div class="graph-example__label" id="borrow-details-query">curl request</div>
			<pre tabindex="0" aria-labelledby="borrow-details-query"><code>curl https://graph.superposition.so/robinhood-testnet/florin \
	  -H 'Content-Type: application/json' \
	  -d '<span data-graph-body>{"query":"query BorrowDetails { borrowDetails { collateral { name } avgRatePa deposited debtIssued } }"}</span>'</code></pre>
			<button type="button" data-graph-run>Send</button>
			<p data-graph-status role="status" aria-live="polite">Click Send to send a request to the testnet graph.</p>
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
			<div class="graph-example__label" id="earn-rewards-query">curl request</div>
			<pre tabindex="0" aria-labelledby="earn-rewards-query"><code>curl https://graph.superposition.so/robinhood-testnet/florin \
	  -H 'Content-Type: application/json' \
	  -d '<span data-graph-body>{"query":"query EarnRewards { earnRewards { collateral { name } apr7dAvg apr24hAvg poolSize coverage } }"}</span>'</code></pre>
			<button type="button" data-graph-run>Send</button>
			<p data-graph-status role="status" aria-live="polite">Click Send to send a request to the testnet graph.</p>
			<pre class="graph-example__response" tabindex="0" aria-label="GraphQL response"><code data-graph-response>No request sent yet.</code></pre>
		</div>
	</div>

Finding open positions for a wallet
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. raw:: html

	<div class="graph-example" data-graph-example>
		<div class="graph-example__explanation">
			<p><code>openPositions(owner: Address!)</code> returns the indexed open positions owned by a wallet.</p><p>Copy the curl command and replace the zero-address placeholder with the wallet address you want to inspect. The Send button uses the placeholder address. An empty list means no open positions were returned for that address.</p><ul><li><code>troveId</code> and <code>troveManager</code>: together identify the position.</li><li><code>owner</code>: position owner.</li><li><code>debt</code>, <code>collateral</code>, and <code>stake</code>: raw 18-decimal integer strings.</li><li><code>annualInterestRate</code>: display-ready annual interest percentage.</li><li><code>interestBatchManager</code>: nullable batch-manager address.</li></ul><p>Keep the trove ID as a string to avoid integer precision loss. Newly opened or changed positions may not appear until indexed.</p>
		</div>
		<div class="graph-example__console">
			<div class="graph-example__label" id="open-positions-query">curl request</div>
			<pre tabindex="0" aria-labelledby="open-positions-query"><code>curl https://graph.superposition.so/robinhood-testnet/florin \
	  -H 'Content-Type: application/json' \
	  -d '<span data-graph-body>{"query":"query OpenPositions { openPositions(owner: \"0x0000000000000000000000000000000000000000\") { troveId troveManager owner debt collateral stake annualInterestRate interestBatchManager } }"}</span>'</code></pre>
			<button type="button" data-graph-run>Send</button>
			<p data-graph-status role="status" aria-live="polite">Click Send to send a request to the testnet graph.</p>
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
			<div class="graph-example__label" id="stability-pool-apr-query">curl request</div>
			<pre tabindex="0" aria-labelledby="stability-pool-apr-query"><code>curl https://graph.superposition.so/robinhood-testnet/florin \
	  -H 'Content-Type: application/json' \
	  -d '<span data-graph-body>{"query":"query StabilityPoolApr { stabilityPoolApr }"}</span>'</code></pre>
			<button type="button" data-graph-run>Send</button>
			<p data-graph-status role="status" aria-live="polite">Click Send to send a request to the testnet graph.</p>
			<pre class="graph-example__response" tabindex="0" aria-label="GraphQL response"><code data-graph-response>No request sent yet.</code></pre>
		</div>
	</div>

Named query caching
~~~~~~~~~~~~~~~~~~~

The Bunny GraphQL middleware caches eligible public queries by their
case-sensitive operation name, such as ``BorrowDetails``, not their root field
name, such as ``borrowDetails``. The current policy in
``bunny-cdn-middleware/main.ts`` is:

.. list-table:: Florin cache policies (seconds)
	:header-rows: 1

	* - Operation name
	  - Fresh TTL
	  - Additional stale-while-revalidate window
	* - ``BorrowDetails``
	  - 3600
	  - 60
	* - ``EarnRewards``
	  - 3600
	  - 60
	* - ``OpenPositions``
	  - 10
	  - 10
	* - ``Markets``
	  - 60
	  - 30
	* - ``StabilityPoolApr``
	  - Not cached (not allowlisted)
	  - None

Within the fresh TTL, a cached response is returned without an origin request.
During the additional stale window, the middleware can return the old response
immediately and refresh it in the background. After both windows expire, the
request waits for an origin response. These windows describe cache freshness,
not how recently the indexer processed the chain; check the response's ingestor
block height before treating a confirmed transaction as indexed.

The curl examples below each contain a single named operation, so the middleware
can infer its name without a separate JSON ``operationName`` property. For a
document containing multiple operations, supply ``operationName`` to select one.
Anonymous queries, unlisted names, mutations, subscriptions, batched requests and
persisted-query extensions bypass this cache.

The operation name selects the policy, but is not the whole cache key. The key
also includes the complete query payload (including variables and any
``operationName``), HTTP method, endpoint path, and the ``Accept``,
``Accept-Language`` and ``Origin`` headers, along with the middleware's origin
configuration and policy. Different wallet addresses or field selections do not
share a cached response. Query text formatting can also produce a different
cache entry.

Requests carrying ``Authorization``, ``Cookie`` or ``X-API-Key`` bypass shared
caching. To explicitly bypass it, add ``-H 'Cache-Control: no-cache'`` to a curl
command. Request ``no-store``, ``max-age=0`` and ``Pragma`` also bypass it; browser
fetch options or DevTools' Disable cache setting can therefore prevent cache
hits. Only eligible successful JSON responses are stored: GraphQL errors,
non-200 responses, cookies and origin cache restrictions can prevent storage.

To inspect caching, add ``-i`` to a curl command and read these response headers:

* ``X-GraphQL-Cache``: ``HIT`` for a fresh cached response, ``STALE`` for a cached
  response served during background refresh, ``MISS`` for an eligible origin
  response, ``BYPASS`` when caching is skipped, or ``ERROR`` on a middleware error.
  A ``MISS`` does not guarantee that the cache write succeeded.
* ``X-GraphQL-Cache-TTL``: the configured fresh TTL in seconds, excluding the
  stale window, on ``MISS``, ``HIT`` and ``STALE`` responses.
* ``Age``: elapsed seconds since the origin fetch began for that response.
  Subtract it from the TTL, with a minimum of zero, to estimate remaining
  freshness. A ``STALE`` response has no fresh time remaining.

The POST examples deliberately return ``Cache-Control: private, no-store`` to
prevent ordinary browser or downstream caches from reusing responses without
accounting for the POST body. This does not disable the middleware's own
body-aware cache. The Send buttons use the same payloads and caching rules as
the displayed commands.