-- migrate:up

-- One observation per pool per worker run, including unavailable APRs. Keeping
-- NULLs/statuses prevents an old successful APR from masquerading as current.
-- No FK to live accounting: history survives replacement of source snapshots.
CREATE TABLE florin_stability_pool_apr_history_1 (
	id BIGSERIAL PRIMARY KEY,
	recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	stability_pool ADDRESS NOT NULL,
	as_of_block BIGINT,
	as_of_block_hash HASH,
	as_of_timestamp BIGINT,
	apr_24h NUMERIC,
	apr_7d NUMERIC,
	baseline_24h_timestamp BIGINT,
	baseline_7d_timestamp BIGINT,
	status_24h TEXT NOT NULL,
	status_7d TEXT NOT NULL
);

-- GraphQL reads the newest observation, not the newest non-NULL APR.
CREATE INDEX florin_stability_pool_apr_history_1_latest_idx
	ON florin_stability_pool_apr_history_1 (stability_pool, id DESC);

COMMENT ON COLUMN florin_stability_pool_apr_history_1.apr_24h IS
	'Annualised decimal fraction, not a percentage: 0.05 means 5%. NULL means unavailable.';
COMMENT ON COLUMN florin_stability_pool_apr_history_1.apr_7d IS
	'Annualised decimal fraction, not a percentage: 0.05 means 5%. NULL means unavailable.';

-- migrate:down
