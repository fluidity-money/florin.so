-- migrate:up

-- Get the amount of FUSD currently in circulation. FUSD is BOLD at the
-- contract level, so minting and burning are represented by ERC-20 transfers
-- from and to the zero address respectively.
CREATE VIEW florin_fusd_outstanding_1 AS
SELECT COALESCE(
	SUM(
		CASE
			WHEN from_address = '0x0000000000000000000000000000000000000000' THEN value
			WHEN to_address = '0x0000000000000000000000000000000000000000' THEN -value
			ELSE 0
		END
	),
	0
) AS amount
FROM liquity_events_bold_token_transfer;

-- Gets the amount of collateral backing Florin positions. Collateral awaiting
-- redistribution remains in the default pool, so both pools are included.
CREATE VIEW florin_collateral_deposited_1 AS
WITH latest_active_pool AS (
	SELECT DISTINCT ON (emitter_addr)
		emitter_addr,
		coll_balance
	FROM liquity_events_active_pool_coll_balance_updated
	ORDER BY emitter_addr, block_number DESC, id DESC
),
latest_default_pool AS (
	SELECT DISTINCT ON (emitter_addr)
		emitter_addr,
		coll_balance
	FROM liquity_events_default_pool_coll_balance_updated
	ORDER BY emitter_addr, block_number DESC, id DESC
)
SELECT
	COALESCE((SELECT SUM(coll_balance) FROM latest_active_pool), 0) +
	COALESCE((SELECT SUM(coll_balance) FROM latest_default_pool), 0) AS amount;

-- Gets the amount of FUSD currently deposited in the stability pool.
CREATE VIEW florin_stability_pool_1 AS
WITH latest_stability_pool AS (
	SELECT DISTINCT ON (emitter_addr)
		emitter_addr,
		new_balance
	FROM liquity_events_stability_pool_bold_balance_updated
	ORDER BY emitter_addr, block_number DESC, id DESC
)
SELECT COALESCE(SUM(new_balance), 0) AS amount
FROM latest_stability_pool;

-- Get open Florin positions. Every state snapshot has an accompanying
-- TroveOperation, so the latest operation identifies the current snapshot even
-- when a position moves into or out of an interest-rate batch. Batched debt is
-- its current share of the batch's recorded debt.
CREATE VIEW florin_outstanding_positions_1 AS
WITH latest_operation AS (
	SELECT DISTINCT ON (emitter_addr, trove_id)
		id,
		block_hash,
		transaction_hash,
		block_number,
		emitter_addr,
		trove_id,
		operation,
		annual_interest_rate
	FROM liquity_events_trove_operation
	ORDER BY emitter_addr, trove_id, block_number DESC, id DESC
),
latest_batch AS (
	SELECT DISTINCT ON (emitter_addr, interest_batch_manager)
		emitter_addr,
		interest_batch_manager,
		debt,
		annual_interest_rate,
		total_debt_shares
	FROM liquity_events_batch_updated
	ORDER BY emitter_addr, interest_batch_manager, block_number DESC, id DESC
),
latest_owner AS (
	SELECT DISTINCT ON (token_id)
		token_id,
		to_address AS owner
	FROM liquity_events_trove_nft_transfer
	ORDER BY token_id, block_number DESC, id DESC
),
positions AS (
	SELECT
		o.block_hash,
		o.transaction_hash,
		o.block_number,
		o.emitter_addr AS trove_manager,
		o.trove_id,
		owner.owner,
		COALESCE(
			t.debt,
			TRUNC(batch.debt * b.batch_debt_shares / NULLIF(batch.total_debt_shares, 0))
		) AS debt,
		COALESCE(t.coll, b.coll) AS coll,
		COALESCE(t.stake, b.stake) AS stake,
		COALESCE(t.annual_interest_rate, batch.annual_interest_rate, o.annual_interest_rate)
			AS annual_interest_rate,
		COALESCE(t.snapshot_of_total_coll_redist, b.snapshot_of_total_coll_redist)
			AS snapshot_of_total_coll_redist,
		COALESCE(t.snapshot_of_total_debt_redist, b.snapshot_of_total_debt_redist)
			AS snapshot_of_total_debt_redist,
		b.interest_batch_manager
	FROM latest_operation o
	LEFT JOIN liquity_events_trove_updated t
		ON t.emitter_addr = o.emitter_addr
		AND t.trove_id = o.trove_id
		AND t.transaction_hash = o.transaction_hash
	LEFT JOIN liquity_events_batched_trove_updated b
		ON b.emitter_addr = o.emitter_addr
		AND b.trove_id = o.trove_id
		AND b.transaction_hash = o.transaction_hash
	LEFT JOIN latest_batch batch
		ON batch.emitter_addr = b.emitter_addr
		AND batch.interest_batch_manager = b.interest_batch_manager
	LEFT JOIN latest_owner owner ON owner.token_id = o.trove_id
	WHERE o.operation NOT IN (1, 5)
)
SELECT *
FROM positions
WHERE debt > 0 AND coll > 0;

-- migrate:down

DROP VIEW florin_outstanding_positions_1;
DROP VIEW florin_stability_pool_1;
DROP VIEW florin_collateral_deposited_1;
DROP VIEW florin_fusd_outstanding_1;
