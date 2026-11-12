-- migrate:up

CREATE TABLE florin_chain_blocks_1 (
	block_number BIGINT PRIMARY KEY CHECK (block_number >= 0),
	block_hash HASH NOT NULL,
	block_timestamp BIGINT NOT NULL CHECK (block_timestamp >= 0),
	UNIQUE (block_number, block_hash)
);

CREATE TABLE florin_stability_pool_accounting_1 (
	stability_pool ADDRESS NOT NULL,
	block_number BIGINT NOT NULL,
	block_hash HASH NOT NULL,
	p HUGEINT NOT NULL CHECK (p > 0),
	scale HUGEINT NOT NULL CHECK (scale >= 0),
	b HUGEINT NOT NULL CHECK (b >= 0),
	total_deposits HUGEINT NOT NULL CHECK (total_deposits >= 0),
	pending_yield HUGEINT NOT NULL CHECK (pending_yield >= 0),
	PRIMARY KEY (stability_pool, block_number),
	FOREIGN KEY (block_number, block_hash)
		REFERENCES florin_chain_blocks_1 (block_number, block_hash) ON DELETE CASCADE
);

CREATE INDEX liquity_events_b_updated_pool_block_id_idx
	ON liquity_events_b_updated (emitter_addr, block_number, id);
CREATE INDEX liquity_events_p_updated_pool_block_id_idx
	ON liquity_events_p_updated (emitter_addr, block_number, id);

CREATE VIEW florin_stability_pool_apr_1 AS
WITH pools AS (
	SELECT stability_pool FROM florin_stability_pool_accounting_1
	UNION
	SELECT emitter_addr FROM liquity_events_b_updated
	UNION
	SELECT emitter_addr FROM liquity_events_stability_pool_bold_balance_updated
),
latest AS (
	SELECT DISTINCT ON (stability_pool) *
	FROM florin_stability_pool_accounting_1
	ORDER BY stability_pool, block_number DESC
),
state AS (
	SELECT pools.stability_pool, s.block_number, s.block_hash, s.p, s.scale,
		h.block_timestamp AS as_of_timestamp,
		h.block_timestamp - pace.block_timestamp AS pace_seconds,
		checkpoint.block_number AS next_indexed_block,
		s.b + CASE WHEN s.total_deposits > 0 AND s.pending_yield > 0
			THEN div(s.p * s.pending_yield, s.total_deposits)
			ELSE 0 END AS effective_b
	FROM pools
	LEFT JOIN latest s USING (stability_pool)
	LEFT JOIN florin_chain_blocks_1 h
		ON h.block_number = s.block_number AND h.block_hash = s.block_hash
	LEFT JOIN florin_chain_blocks_1 pace ON pace.block_number = s.block_number - 100000
	LEFT JOIN florin_ingestor_checkpointing_1 checkpoint ON checkpoint.id = 1
),
windows AS (
	SELECT s.*, w.window_seconds,
		-- ceil(n / d) using integer div, avoiding numeric division rounding.
		GREATEST(0, s.block_number - div(
			w.window_seconds::numeric * 100000 + s.pace_seconds - 1,
			NULLIF(s.pace_seconds, 0))) AS start_block,
		GREATEST(0, s.block_number - div(
			691200::numeric * 100000 + s.pace_seconds - 1,
			NULLIF(s.pace_seconds, 0))) AS from_block
	FROM state s CROSS JOIN (VALUES (86400), (604800)) w(window_seconds)
),
baselines AS (
	SELECT w.*, baseline.b AS baseline_b, baseline.scale AS baseline_scale,
		baseline.block_number AS baseline_block, baseline.block_hash AS baseline_hash,
		baseline.block_number <= w.start_block AS full_window,
		h.block_timestamp AS baseline_timestamp,
		CASE WHEN NOT EXISTS (
			SELECT 1 FROM liquity_events_p_updated e
			WHERE e.emitter_addr = w.stability_pool
				AND e.block_number BETWEEN w.from_block AND w.block_number
		) THEN w.p ELSE starting_p.p END AS baseline_p
	FROM windows w
	LEFT JOIN LATERAL (
		-- Last payout <= target, or first payout in the fetched range.
		SELECT e.b, e.scale, e.block_number, e.block_hash
		FROM liquity_events_b_updated e
		WHERE e.emitter_addr = w.stability_pool
			AND e.block_number BETWEEN w.from_block AND w.block_number
		ORDER BY (e.block_number <= w.start_block) DESC,
			CASE WHEN e.block_number <= w.start_block THEN e.block_number END DESC,
			CASE WHEN e.block_number <= w.start_block THEN e.id END DESC,
			e.block_number ASC, e.id ASC
		LIMIT 1
	) baseline ON true
	LEFT JOIN florin_chain_blocks_1 h ON h.block_number = baseline.block_number
		AND h.block_hash = baseline.block_hash
	LEFT JOIN LATERAL (
		SELECT e.p FROM liquity_events_p_updated e
		WHERE e.emitter_addr = w.stability_pool
			AND e.block_number BETWEEN w.from_block AND baseline.block_number
		ORDER BY e.block_number DESC, e.id DESC
		LIMIT 1
	) starting_p ON true
),
checked AS (
	SELECT *, as_of_timestamp - baseline_timestamp AS elapsed_seconds,
		CASE
			WHEN block_number IS NULL THEN 'missing_snapshot'
			WHEN next_indexed_block IS NULL OR next_indexed_block <= block_number
				THEN 'events_not_indexed'
			WHEN block_number <= 100000 THEN 'insufficient_chain_history'
			WHEN pace_seconds IS NULL THEN 'missing_pace_block'
			WHEN pace_seconds <= 0 THEN 'invalid_block_pace'
			WHEN baseline_block IS NULL THEN 'missing_baseline'
			WHEN baseline_scale <> scale THEN 'scale_changed'
			WHEN baseline_p IS NULL THEN 'unknown_baseline_p'
			WHEN baseline_timestamp IS NULL THEN 'missing_baseline_timestamp'
			WHEN baseline_p <= 0 OR as_of_timestamp <= baseline_timestamp
				OR effective_b < baseline_b THEN 'invalid_return'
			WHEN NOT full_window AND as_of_timestamp - baseline_timestamp < window_seconds / 2
				THEN 'insufficient_history'
			ELSE 'ok'
		END AS status
	FROM baselines
),
returns AS (
	SELECT *, CASE WHEN status = 'ok' THEN
		-- Match bigint truncation to 1e12 in realisedApr before annualising.
		div((effective_b - baseline_b) * 1000000000000, NULLIF(baseline_p, 0))
			* 31536000 / 1000000000000::numeric / NULLIF(elapsed_seconds, 0)
		END AS apr
	FROM checked
)
SELECT stability_pool, block_number AS as_of_block, block_hash AS as_of_block_hash,
	as_of_timestamp,
	MAX(apr) FILTER (WHERE window_seconds = 86400) AS apr_24h,
	MAX(apr) FILTER (WHERE window_seconds = 604800) AS apr_7d,
	MAX(baseline_timestamp) FILTER (WHERE window_seconds = 86400) AS baseline_24h_timestamp,
	MAX(baseline_timestamp) FILTER (WHERE window_seconds = 604800) AS baseline_7d_timestamp,
	MAX(status) FILTER (WHERE window_seconds = 86400) AS status_24h,
	MAX(status) FILTER (WHERE window_seconds = 604800) AS status_7d
FROM returns
GROUP BY stability_pool, block_number, block_hash, as_of_timestamp;

-- migrate:down
