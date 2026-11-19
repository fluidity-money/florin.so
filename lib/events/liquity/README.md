# Liquity events

This package contains the event-only ABIs and Go decoders used by the Ethereum
log ingestor.

The event definitions were copied from Liquity's `bold` repository at commit
`c8a5a4ee2e9dc024905856b6698a77d849c68c7e`, including the generated frontend
ABIs and the Solidity definitions for events not exposed by the frontend.

The ABI is split because ERC-20 BOLD and ERC-721 Trove NFTs both define
`Approval` and `Transfer` with the same canonical signatures. `UnpackLog`
distinguishes them by indexed-topic count. The ingestor also restricts log
queries and dispatch to named contract settings (`SPN_BOLD_TOKEN_ADDR`,
`SPN_TROVE_NFT_ADDR`, `SPN_ACTIVE_POOL_ADDR`, etc.; see the root README).
There is no address-list environment variable. The ingestor checks named token
roles as well as indexed-topic counts: ordinary ERC-20 transfers, including
Yearn vault shares, cannot be mistaken for BOLD events.

## Governance indexing deployment

`governance-abi.json` is an event-only ABI transcribed from
`florin-contracts/contracts/src/GovernanceUpgradeFlowThrough.sol` and
`IERC1967.Upgraded`. The three operation digests are non-indexed bytes32 values,
stored as 0x-prefixed, 66-character strings in HASH columns. Upgraded's
implementation is indexed and stored as a lowercase ADDRESS. StorageWiped has
no payload. These events use the same database envelope as other Liquity events.

Before starting the updated ingestor, apply the forward dbmate migration
`db/migrations/1794918000-governance_events.sql` using the deployment database's
normal migration procedure (`dbmate --migrations-dir db/migrations up` from the
repository root, with the correct DATABASE_URL). Do not rely on editing or
reapplying the original Liquity tables migration.

Set the optional `SPN_GOVERNANCE_ADDR` to the governance **proxy address**.
Execution through delegatecall emits logs at the proxy, not at the implementation
address. Leave it blank on deployments without governance. Upgraded events from
named Liquity contracts remain indexed; events from unconfigured emitters are
ignored. Do not configure an implementation address as a second emitter.

Deploying the new filter does not recover governance logs before the current
checkpoint. Recover historical missing events with a controlled backfill,
restricted to these five signatures, the intended proxy addresses, and an
explicit historical block range. Coordinate with live ingestion to avoid range
overlap and track processed log identities (chain, block hash, transaction hash,
log index) outside these tables or otherwise make the backfill idempotent.
The existing envelope has no log index or event uniqueness constraint, and
multiple identical events in one transaction can be legitimate. Do not blindly
rewind the shared checkpoint: replaying all events would duplicate existing rows.
Validate backfill counts against RPC logs before resuming normal operation.
