# Liquity events

This package contains the event-only ABIs and Go decoders used by the Ethereum
log ingestor.

The event definitions were copied from Liquity's `bold` repository at commit
`c8a5a4ee2e9dc024905856b6698a77d849c68c7e`, including the generated frontend
ABIs and the Solidity definitions for events not exposed by the frontend.

The ABI is split because ERC-20 BOLD and ERC-721 Trove NFTs both define
`Approval` and `Transfer` with the same canonical signatures. `UnpackLog`
distinguishes them by indexed-topic count. The ingestor also restricts log
queries and dispatch to the contract addresses supplied through the
comma-separated `SPN_LIQUITY_ADDRS` environment variable; this is required so
ordinary ERC-20 events elsewhere on the chain are not mistaken for BOLD events.

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

Include the governance **proxy address** in the existing comma-separated
`SPN_LIQUITY_ADDRS` allowlist, alongside the existing Liquity emitters. Execution
through delegatecall emits logs at the proxy, not at the implementation address.
No separate governance allowlist is used. Upgraded events from any allowlisted
emitter are indexed; events from unlisted emitters are ignored.

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
