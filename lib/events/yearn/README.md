# Yearn V3 vault and factory events

Source repository: https://github.com/yearn/yearn-vaults-v3
Pinned commit: `f449264ff4f8bebe9a6bf72e43095304fdf101b8`
Source API version: `3.1.1`; compiler: Vyper `0.3.10`.

Authoritative contracts:

- https://github.com/yearn/yearn-vaults-v3/blob/f449264ff4f8bebe9a6bf72e43095304fdf101b8/contracts/VaultV3.vy
- https://github.com/yearn/yearn-vaults-v3/blob/f449264ff4f8bebe9a6bf72e43095304fdf101b8/contracts/VaultFactory.vy

The handwritten, event-only `vault-abi.json` and `factory-abi.json` cover all
24 vault events and all 8 factory events in those sources. During implementation,
both pinned sources were compiled with `vyper -f abi` (Vyper 0.3.10), and every
event name, argument name, ABI type and indexed flag was compared to these ABIs.
No generated bindings or generated database schema files are required.

Scope is VaultV3 and VaultFactory only, NOT the separate TokenizedStrategy repo.
In particular, StrategyReported here is the vault event, not the strategy event.
Vyper Roles and StrategyChangeType are ABI `uint256` bit flags, not Solidity
`uint8` enums. Values are preserved losslessly as events.Number. Contract-level
business constraints (for example allowed fee rates or role combinations) are
not imposed by the decoder. The dynamic queue is bounded by source MAX_QUEUE=10.
Earlier Yearn V3 releases can have different events (for example limit modules
instead of hooks); this package does not claim complete historical ABI coverage
for releases other than this pin. Audit each deployment/version before enabling.

## API and storage

- Check `ErrABI` at startup; a non-nil value is fatal configuration/code damage.
- `FilterTopics()` returns a fresh sorted union of all signature topics.
- `UnpackVaultLog(types.Log)` and `UnpackFactoryLog(types.Log)` return pointers to
  concrete event structs, or `(nil, nil)` for an unknown signature in that ABI.
- A missing signature or malformed known event returns an error. Exact topic
  counts and canonical ABI round trips reject trailing/truncated data, bad
  offsets, dirty address padding, invalid booleans and uint16 overflow.
- As in the Liquity decoder, the embedded `events.Event` remains zero-valued.
  The ingestor attaches block/transaction hashes, block number, emitter and
  creation timestamp. These functions do not authenticate emitter addresses.
- Every struct has a `TableName()` and snake-case JSON column names. uint256
  fields use events.Number/HUGEINT, addresses use events.Address/ADDRESS,
  uint16 fields use Go uint16/SQL INTEGER (not signed SMALLINT), booleans use
  BOOLEAN. The queue uses pq.StringArray/ADDRESS[] with lowercase addresses;
  even an empty queue is non-nil and serializes to an empty SQL array, not NULL.

The forward-only migration is
`db/migrations/1795005000-yearn_events.sql`. It explicitly creates all 32 tables
and uses the existing ADDRESS, HASH and HUGEINT domains. Its down section does
not drop historical data. Like existing event tables, these tables use the
shared envelope and have no chain ID/log index or deduplication key; ingestion
must preserve the existing single-chain database and checkpoint conventions.

## Deployment and backfill

1. Apply the existing domain migrations and this forward migration before
   deploying the ingestor integration. No database has been migrated by this
   package change. Keep any generated database snapshot regeneration separate.
2. Set `SPN_YEARN_VAULT_ADDR` and `SPN_YEARN_VAULT_FACTORY_ADDR` to the
   chain-specific vault and factory. Both are required, single, nonzero addresses
   distinct from every other configured contract. Record deployment blocks for
   backfill. Verify deployed implementations and API versions against this pin;
   do not infer trust from an event signature or enable all emitters globally.
3. The ingestor routes these named addresses to UnpackVaultLog and
   UnpackFactoryLog respectively. ERC-20/4626 signatures also occur on unrelated
   contracts, so signature matching alone is insufficient. Only the named vault
   is ingested: NewVault is recorded but does not automatically enable new vaults.
   There is no user-configured address list.
4. Backfill each emitter from its deployment block, including the deployment
   transaction (vault initialization can emit logs before factory NewVault).
   Discovery-based ingestion must replay that block for the newly found vault.
   Query bounded block ranges with emitter filters and FilterTopics topic zero.
   Preserve canonical log order, attach metadata and persist events and the
   corresponding checkpoint atomically using the parent ingestor's conventions.
5. Pause the relevant live writer before replaying overlapping ranges. Existing
   tables have no automatic log deduplication, so replay into empty ranges or
   explicitly replace the selected Yearn rows transactionally. Never rewind a
   shared checkpoint without accounting for other protocols. Handle reorgs and
   removed logs in the parent ingestor; a decoder alone cannot enforce finality.
6. Reconcile event counts and deployment boundaries, then resume live ingestion.
   Unknown events are ignored by API contract; log/monitor version mismatches
   at the integration boundary rather than silently assuming a complete backfill.

## Verification

Run `go test -race -cover ./lib/events/yearn`.
Tests encode/decode every event with distinct arguments, cover full-width
uint256 and uint16 values, contract routing, topic filtering, malformed topic
counts and data, empty/full/overlong queues, invalid array offsets/lengths and
padding, SQL array serialization, and every struct/table/column SQL type.
Tests are offline and do not require a database or compiler. SQL consistency
checks inspect the explicit migration; they are not a live migration test.
