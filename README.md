# Florin

## Robinhood testnet borrowing

The `/open` flow talks directly to the canonical Bold Stylus deployment on
Robinhood Chain Testnet (chain ID `46630`). It reads the SPY balance, allowance,
oracle price and predicted upfront fee, obtains sorted-trove hints, approves the
exact SPY requirement, then calls `BorrowerOperations.openTrove`.

An injected browser wallet works without configuration. Set
`NEXT_PUBLIC_REOWN_PROJECT_ID` to enable the Reown/WalletConnect modal as well.
The connected wallet needs testnet ETH and testnet SPY. Opening a trove also
requires the protocol's separate `0.001 ETH` liquidator-compensation deposit.

## Analytics

Set `NEXT_PUBLIC_POSTHOG_KEY` to enable PostHog analytics in the web app.
`NEXT_PUBLIC_POSTHOG_HOST` defaults to `https://us.i.posthog.com`; set it to
`https://eu.i.posthog.com` for PostHog EU Cloud or to your self-hosted endpoint.
Visitors are shown a cookie consent banner. PostHog is not initialized and no
analytics data is sent until they allow analytics. Once allowed, page views
(including client-side route changes), page leaves, exceptions, and PostHog's
automatic interaction events are captured. Explicit product events cover wallet
connection, CTA and faucet use, risk-dialog engagement, form starts and Max
selection, mode changes, and the requested/succeeded/failed lifecycle for open,
manage-position, and Stability Pool transactions. Transaction events deliberately
exclude wallet addresses, transaction hashes, contract addresses, exact amounts,
and raw error details.
