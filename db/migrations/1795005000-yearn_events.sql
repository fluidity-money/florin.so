-- migrate:up

CREATE TABLE yearn_events_deposit (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	sender ADDRESS NOT NULL,
	owner ADDRESS NOT NULL,
	assets HUGEINT NOT NULL,
	shares HUGEINT NOT NULL
);

CREATE TABLE yearn_events_withdraw (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	sender ADDRESS NOT NULL,
	receiver ADDRESS NOT NULL,
	owner ADDRESS NOT NULL,
	assets HUGEINT NOT NULL,
	shares HUGEINT NOT NULL
);

CREATE TABLE yearn_events_transfer (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	sender ADDRESS NOT NULL,
	receiver ADDRESS NOT NULL,
	value HUGEINT NOT NULL
);

CREATE TABLE yearn_events_approval (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	owner ADDRESS NOT NULL,
	spender ADDRESS NOT NULL,
	value HUGEINT NOT NULL
);

CREATE TABLE yearn_events_strategy_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	strategy ADDRESS NOT NULL,
	change_type HUGEINT NOT NULL
);

CREATE TABLE yearn_events_strategy_reported (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	strategy ADDRESS NOT NULL,
	gain HUGEINT NOT NULL,
	loss HUGEINT NOT NULL,
	current_debt HUGEINT NOT NULL,
	protocol_fees HUGEINT NOT NULL,
	total_fees HUGEINT NOT NULL,
	total_refunds HUGEINT NOT NULL
);

CREATE TABLE yearn_events_debt_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	strategy ADDRESS NOT NULL,
	current_debt HUGEINT NOT NULL,
	new_debt HUGEINT NOT NULL
);

CREATE TABLE yearn_events_role_set (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	account ADDRESS NOT NULL,
	role HUGEINT NOT NULL
);

CREATE TABLE yearn_events_update_future_role_manager (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	future_role_manager ADDRESS NOT NULL
);

CREATE TABLE yearn_events_update_role_manager (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	role_manager ADDRESS NOT NULL
);

CREATE TABLE yearn_events_update_accountant (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	accountant ADDRESS NOT NULL
);

CREATE TABLE yearn_events_update_deposit_hook (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	deposit_hook ADDRESS NOT NULL
);

CREATE TABLE yearn_events_update_withdraw_hook (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	withdraw_hook ADDRESS NOT NULL
);

CREATE TABLE yearn_events_update_transfer_hook (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	transfer_hook ADDRESS NOT NULL
);

CREATE TABLE yearn_events_update_default_queue (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	new_default_queue ADDRESS[] NOT NULL
);

CREATE TABLE yearn_events_update_use_default_queue (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	use_default_queue BOOLEAN NOT NULL
);

CREATE TABLE yearn_events_update_auto_allocate (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	auto_allocate BOOLEAN NOT NULL
);

CREATE TABLE yearn_events_update_paused (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	paused BOOLEAN NOT NULL
);

CREATE TABLE yearn_events_updated_max_debt_for_strategy (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	sender ADDRESS NOT NULL,
	strategy ADDRESS NOT NULL,
	new_debt HUGEINT NOT NULL
);

CREATE TABLE yearn_events_update_deposit_limit (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	deposit_limit HUGEINT NOT NULL
);

CREATE TABLE yearn_events_update_minimum_total_idle (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	minimum_total_idle HUGEINT NOT NULL
);

CREATE TABLE yearn_events_update_profit_max_unlock_time (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	profit_max_unlock_time HUGEINT NOT NULL
);

CREATE TABLE yearn_events_debt_purchased (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	strategy ADDRESS NOT NULL,
	amount HUGEINT NOT NULL
);

CREATE TABLE yearn_events_shutdown (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL
);

CREATE TABLE yearn_events_new_vault (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	vault_address ADDRESS NOT NULL,
	asset ADDRESS NOT NULL
);

CREATE TABLE yearn_events_update_protocol_fee_bps (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	old_fee_bps INTEGER NOT NULL,
	new_fee_bps INTEGER NOT NULL
);

CREATE TABLE yearn_events_update_protocol_fee_recipient (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	old_fee_recipient ADDRESS NOT NULL,
	new_fee_recipient ADDRESS NOT NULL
);

CREATE TABLE yearn_events_update_custom_protocol_fee (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	vault ADDRESS NOT NULL,
	new_custom_protocol_fee INTEGER NOT NULL
);

CREATE TABLE yearn_events_removed_custom_protocol_fee (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	vault ADDRESS NOT NULL
);

CREATE TABLE yearn_events_factory_shutdown (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL
);

CREATE TABLE yearn_events_governance_transferred (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	previous_governance ADDRESS NOT NULL,
	new_governance ADDRESS NOT NULL
);

CREATE TABLE yearn_events_update_pending_governance (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,
	new_pending_governance ADDRESS NOT NULL
);

-- migrate:down
-- Forward-only: retain indexed event history.
