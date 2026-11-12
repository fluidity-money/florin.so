-- migrate:up

CREATE TABLE florin_apr_recorded_1 (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	stability_pool ADDRESS NOT NULL,
	active_pool ADDRESS NOT NULL,
	apr DECIMAL NOT NULL
);

CREATE INDEX ON florin_apr_recorded_1 (stability_pool, active_pool);

-- migrate:down
