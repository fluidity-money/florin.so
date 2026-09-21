-- migrate:up

CREATE TABLE liquity_events_active_pool_address_added (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_active_pool_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_active_pool_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_active_pool_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_active_pool_bold_debt_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	recorded_debt_sum HUGEINT NOT NULL
);

CREATE TABLE liquity_events_active_pool_coll_balance_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	coll_balance HUGEINT NOT NULL
);

CREATE TABLE liquity_events_add_manager_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	trove_id HUGEINT NOT NULL,
	new_add_manager ADDRESS NOT NULL
);

CREATE TABLE liquity_events_b_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	b HUGEINT NOT NULL,
	scale HUGEINT NOT NULL
);

CREATE TABLE liquity_events_base_rate_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	base_rate HUGEINT NOT NULL
);

CREATE TABLE liquity_events_batch_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	interest_batch_manager ADDRESS NOT NULL,
	operation INTEGER NOT NULL,
	debt HUGEINT NOT NULL,
	coll HUGEINT NOT NULL,
	annual_interest_rate HUGEINT NOT NULL,
	annual_management_fee HUGEINT NOT NULL,
	total_debt_shares HUGEINT NOT NULL,
	debt_increase_from_upfront_fee HUGEINT NOT NULL
);

CREATE TABLE liquity_events_batched_trove_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	trove_id HUGEINT NOT NULL,
	interest_batch_manager ADDRESS NOT NULL,
	batch_debt_shares HUGEINT NOT NULL,
	coll HUGEINT NOT NULL,
	stake HUGEINT NOT NULL,
	snapshot_of_total_coll_redist HUGEINT NOT NULL,
	snapshot_of_total_debt_redist HUGEINT NOT NULL
);

CREATE TABLE liquity_events_bold_token_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_bold_token_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_bold_token_approval (
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

CREATE TABLE liquity_events_bold_token_transfer (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	from_address ADDRESS NOT NULL,
	to_address ADDRESS NOT NULL,
	value HUGEINT NOT NULL
);

CREATE TABLE liquity_events_borrower_operations_address_added (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_borrower_operations_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_borrower_operations_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_borrower_operations_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_coll_balance_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	account ADDRESS NOT NULL,
	new_balance HUGEINT NOT NULL
);

CREATE TABLE liquity_events_coll_sent (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	to_address ADDRESS NOT NULL,
	amount HUGEINT NOT NULL
);

CREATE TABLE liquity_events_coll_surplus_pool_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	coll_surplus_pool_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_coll_token_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_coll_token_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_collateral_registry_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	collateral_registry_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_default_pool_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_default_pool_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_default_pool_bold_debt_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	bold_debt HUGEINT NOT NULL
);

CREATE TABLE liquity_events_default_pool_coll_balance_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	coll_balance HUGEINT NOT NULL
);

CREATE TABLE liquity_events_deposit_operation (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	depositor ADDRESS NOT NULL,
	operation INTEGER NOT NULL,
	deposit_loss_since_last_operation HUGEINT NOT NULL,
	top_up_or_withdrawal HUGEINT NOT NULL,
	yield_gain_since_last_operation HUGEINT NOT NULL,
	yield_gain_claimed HUGEINT NOT NULL,
	eth_gain_since_last_operation HUGEINT NOT NULL,
	eth_gain_claimed HUGEINT NOT NULL
);

CREATE TABLE liquity_events_deposit_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	depositor ADDRESS NOT NULL,
	new_deposit HUGEINT NOT NULL,
	stashed_coll HUGEINT NOT NULL,
	snapshot_p HUGEINT NOT NULL,
	snapshot_s HUGEINT NOT NULL,
	snapshot_b HUGEINT NOT NULL,
	snapshot_scale HUGEINT NOT NULL
);

CREATE TABLE liquity_events_gas_pool_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	gas_pool_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_hint_helpers_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	hint_helpers_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_interest_router_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	interest_router_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_last_good_price_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	last_good_price HUGEINT NOT NULL
);

CREATE TABLE liquity_events_last_fee_op_time_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	last_fee_op_time HUGEINT NOT NULL
);

CREATE TABLE liquity_events_liquidation (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	debt_offset_by_sp HUGEINT NOT NULL,
	debt_redistributed HUGEINT NOT NULL,
	bold_gas_compensation HUGEINT NOT NULL,
	coll_gas_compensation HUGEINT NOT NULL,
	coll_sent_to_sp HUGEINT NOT NULL,
	coll_redistributed HUGEINT NOT NULL,
	coll_surplus HUGEINT NOT NULL,
	l_eth HUGEINT NOT NULL,
	l_bold_debt HUGEINT NOT NULL,
	price HUGEINT NOT NULL
);

CREATE TABLE liquity_events_metadata_nft_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	metadata_nft_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_multi_trove_getter_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	multi_trove_getter_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_ownership_transferred (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	previous_owner ADDRESS NOT NULL,
	new_owner ADDRESS NOT NULL
);

CREATE TABLE liquity_events_p_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	p HUGEINT NOT NULL
);

CREATE TABLE liquity_events_price_feed_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_price_feed_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_redemption (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	attempted_bold_amount HUGEINT NOT NULL,
	actual_bold_amount HUGEINT NOT NULL,
	eth_sent HUGEINT NOT NULL,
	eth_fee HUGEINT NOT NULL,
	price HUGEINT NOT NULL,
	redemption_price HUGEINT NOT NULL
);

CREATE TABLE liquity_events_redemption_fee_paid_to_trove (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	trove_id HUGEINT NOT NULL,
	eth_fee HUGEINT NOT NULL
);

CREATE TABLE liquity_events_remove_manager_and_receiver_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	trove_id HUGEINT NOT NULL,
	new_remove_manager ADDRESS NOT NULL,
	new_receiver ADDRESS NOT NULL
);

CREATE TABLE liquity_events_s_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	s HUGEINT NOT NULL,
	scale HUGEINT NOT NULL
);

CREATE TABLE liquity_events_scale_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	current_scale HUGEINT NOT NULL
);

CREATE TABLE liquity_events_shut_down_from_oracle_failure (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	failed_oracle_addr ADDRESS NOT NULL
);

CREATE TABLE liquity_events_sorted_troves_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	sorted_troves_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_stability_pool_address_added (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_stability_pool_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_stability_pool_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	stability_pool_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_stability_pool_bold_balance_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_balance HUGEINT NOT NULL
);

CREATE TABLE liquity_events_stability_pool_coll_balance_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_balance HUGEINT NOT NULL
);

CREATE TABLE liquity_events_trove_manager_address_added (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_trove_manager_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_trove_manager_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_trove_manager_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_trove_nft_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	new_trove_nft_address ADDRESS NOT NULL
);

CREATE TABLE liquity_events_trove_nft_approval (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	owner ADDRESS NOT NULL,
	approved ADDRESS NOT NULL,
	token_id HUGEINT NOT NULL
);

CREATE TABLE liquity_events_trove_nft_approval_for_all (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	owner ADDRESS NOT NULL,
	operator ADDRESS NOT NULL,
	approved BOOLEAN NOT NULL
);

CREATE TABLE liquity_events_trove_nft_transfer (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	from_address ADDRESS NOT NULL,
	to_address ADDRESS NOT NULL,
	token_id HUGEINT NOT NULL
);

CREATE TABLE liquity_events_trove_operation (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	trove_id HUGEINT NOT NULL,
	operation INTEGER NOT NULL,
	annual_interest_rate HUGEINT NOT NULL,
	debt_increase_from_redist HUGEINT NOT NULL,
	debt_increase_from_upfront_fee HUGEINT NOT NULL,
	debt_change_from_operation HUGEINT NOT NULL,
	coll_increase_from_redist HUGEINT NOT NULL,
	coll_change_from_operation HUGEINT NOT NULL
);

CREATE TABLE liquity_events_trove_updated (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	trove_id HUGEINT NOT NULL,
	debt HUGEINT NOT NULL,
	coll HUGEINT NOT NULL,
	stake HUGEINT NOT NULL,
	annual_interest_rate HUGEINT NOT NULL,
	snapshot_of_total_coll_redist HUGEINT NOT NULL,
	snapshot_of_total_debt_redist HUGEINT NOT NULL
);

CREATE TABLE liquity_events_weth_address_changed (
	id SERIAL PRIMARY KEY,
	created_by TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	block_hash HASH NOT NULL,
	transaction_hash HASH NOT NULL,
	block_number INTEGER NOT NULL,
	emitter_addr ADDRESS NOT NULL,

	weth_address ADDRESS NOT NULL
);

-- migrate:down
