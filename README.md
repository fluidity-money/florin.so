# Florin

This repo contains a webapp written with Next, and a backend and a graph written in Go
using Gqlgen for GraphQL.

## Building the graph/ingestor

	make

## Environment variables

### Backend

| Variable | Purpose |
|---|---|
| SPN_DEBUG | Enables debug logging in the ingestor |
| SPN_SUPERPOSITION_URL | Superposition chain RPC URL (feeds the indexer) |
| SPN_YEARN_VAULT_ADDR | Yearn V3 vault (share-token emitter) |
| SPN_YEARN_VAULT_FACTORY_ADDR | Yearn V3 vault factory |
| SPN_BOLD_TOKEN_ADDR | BOLD token |
| SPN_COLLATERAL_REGISTRY_ADDR | Collateral registry |
| SPN_ADDRESSES_REGISTRY_ADDR | Addresses registry |
| SPN_ACTIVE_POOL_ADDR | Active pool |
| SPN_BORROWER_OPERATIONS_ADDR | Borrower operations (ingestor setting) |
| SPN_COLL_SURPLUS_POOL_ADDR | Collateral surplus pool |
| SPN_DEFAULT_POOL_ADDR | Default pool |
| SPN_SORTED_TROVES_ADDR | Sorted troves |
| SPN_STABILITY_POOL_ADDR | Stability pool |
| SPN_TROVE_MANAGER_ADDR | Trove manager |
| SPN_TROVE_NFT_ADDR | Trove NFT |
| SPN_PRICE_FEED_ADDR | Price feed |
| SPN_GOVERNANCE_ADDR | Optional governance proxy; leave blank if not deployed |
| SPN_HEARTBEAT_URL | Webhook/URL to ping for liveness heartbeat |
| SPN_TIMESCALE | TimescaleDB/Postgres connection URL for storing events |

### Graphql

| Variable | Purpose |
|---|---|
| SPN_TIMESCALE | TimescaleDB/Postgres URL — ingestor writes events; graphql reads keys |
| SPN_GETH_URL | Ethereum/chain RPC endpoint for the GraphQL server |
| SPN_CHAIN_ID | Chain ID (decoded as big.Int) |
| SPN_ACCOUNTS_ADDR | Accounts factory contract address |
| SPN_ACCOUNTS_PUBLIC_KEY | Accounts verification public key (hex-decoded) |
| SPN_ACCOUNTS_PRIVATE_KEY | Accounts signing private key (hex-decoded) |
| SPN_SAFETY_ROUTER_ADDR | Safety router contract address |
| SPN_BORROWER_OPERATIONS | Borrower operations contract address |
| SPN_FAUCET_ADDR | Faucet contract address |
| SPN_WETH_ADDR | WETH contract address |
| SPN_FEATURE_FAKE_DATA | If set (non-empty), enables fake-data feature flag |
| SPN_TIMESCALE | Postgres/TimescaleDB URL for loading account private keys |

### Webapp

| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_REOWN_PROJECT_ID | Reown project ID for the wallet modal / WalletConnect (optional) |
| NEXT_PUBLIC_SITE_URL | Canonical site URL (e.g. http://localhost:3000) |
| NEXT_PUBLIC_POSTHOG_KEY | PostHog analytics API key (optional) |
| NEXT_PUBLIC_POSTHOG_HOST | PostHog ingest host (default https://us.i.posthog.com) |
| NEXT_PUBLIC_ACCOUNTS_URL | Accounts GraphQL API to discover signing key / renew secrets |
| NEXT_PUBLIC_ACCOUNT_AUTHORITY_ADDR | FreshBackwards resolver authority address (zero-address) |
