-- migrate:up

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'hugeint'
	) THEN
		CREATE DOMAIN HUGEINT AS NUMERIC(78, 0);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'address'
	) THEN
		CREATE DOMAIN ADDRESS AS CHAR(42);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'hash'
	) THEN
		CREATE DOMAIN HASH AS CHAR(66);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'bytes8'
	) THEN
		CREATE DOMAIN BYTES8 AS CHAR(16);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'bytes32'
	) THEN
		CREATE DOMAIN BYTES32 AS CHAR(64);
	END IF;
END $$;

CREATE TABLE florin_ingestor_checkpointing_1 (
	id SERIAL PRIMARY KEY,
	last_updated TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	block_number INTEGER NOT NULL
);

-- migrate:down
