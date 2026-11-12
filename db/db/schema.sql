\restrict u82MA4UfaMyVnL84zaKAOce3YMpnSV4GZt7WPCV6UBytk51q8zL4Ntat01bogWz

-- Dumped from database version 16.13 (Ubuntu 16.13-1.pgdg22.04+1)
-- Dumped by pg_dump version 17.11 (Debian 17.11-0+deb13u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: timescaledb; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS timescaledb WITH SCHEMA public;


--
-- Name: EXTENSION timescaledb; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION timescaledb IS 'Enables scalable inserts and complex queries for time-series data (Community Edition)';


--
-- Name: timescaledb_toolkit; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS timescaledb_toolkit WITH SCHEMA public;


--
-- Name: EXTENSION timescaledb_toolkit; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION timescaledb_toolkit IS 'Library of analytical hyperfunctions, time-series pipelining, and other SQL utilities';


--
-- Name: address; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.address AS character(42);


--
-- Name: bytes16; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.bytes16 AS character(32);


--
-- Name: bytes32; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.bytes32 AS character(64);


--
-- Name: bytes64; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.bytes64 AS character(128);


--
-- Name: bytes8; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.bytes8 AS character(16);


--
-- Name: hash; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.hash AS character(66);


--
-- Name: hugeint; Type: DOMAIN; Schema: public; Owner: -
--

CREATE DOMAIN public.hugeint AS numeric(78,0);


--
-- Name: accounts_get_private_key_1(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accounts_get_private_key_1() RETURNS public.bytes32
    LANGUAGE plpgsql
    AS $$
DECLARE
	selected_key BYTES64;
	random_offset INT;
	total_rows INT;
BEGIN
	SELECT COUNT(*) INTO total_rows FROM accounts_sender_keys_1;
	IF total_rows > 0 THEN
		random_offset := floor(random() * LEAST(5, total_rows))::INT;
		UPDATE accounts_sender_keys_1
		SET last_accessed = NOW()
		WHERE id = (
			SELECT id
			FROM accounts_sender_keys_1
			ORDER BY last_accessed ASC
			LIMIT 1
			OFFSET random_offset
		)
		RETURNING private_key INTO selected_key;
	END IF;
	RETURN selected_key;
END;
$$;


--
-- Name: accounts_get_private_key_2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accounts_get_private_key_2() RETURNS public.bytes32
    LANGUAGE plpgsql
    AS $$
DECLARE
	selected_key BYTES32;
BEGIN
	UPDATE accounts_sender_keys_1
	SET last_accessed = NOW()
	WHERE id = (
		SELECT id
		FROM accounts_sender_keys_1
		ORDER BY last_accessed ASC NULLS FIRST
		LIMIT 1
	)
	RETURNING private_key INTO selected_key;
	RETURN selected_key;
END;
$$;


--
-- Name: accounts_insert_nonce_1(public.address, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accounts_insert_nonce_1(p_eoa_addr public.address, p_consumed_nonce integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
	v_secret_id INTEGER;
	v_nonce_id INTEGER;
BEGIN
	SELECT id INTO v_secret_id
	FROM accounts_secrets_1
	WHERE eoa_addr = p_eoa_addr;
	IF v_secret_id IS NULL THEN
		RAISE EXCEPTION 'address not found';
	END IF;
	INSERT INTO accounts_secrets_nonces_1 (secret_id, consumed_nonce)
	VALUES (v_secret_id, p_consumed_nonce)
	RETURNING id INTO v_nonce_id;
	RETURN v_nonce_id;
END;
$$;


--
-- Name: accounts_insert_nonce_2(public.address, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accounts_insert_nonce_2(p_eoa_addr public.address, p_consumed_nonce integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
	v_secret_id INTEGER;
	v_nonce_id INTEGER;
BEGIN
	SELECT id INTO v_secret_id
	FROM accounts_secrets_1
	WHERE eoa_addr = p_eoa_addr AND valid_until > CURRENT_TIMESTAMP;
	IF v_secret_id IS NULL THEN
		RAISE EXCEPTION 'address not found';
	END IF;
	INSERT INTO accounts_secrets_nonces_1 (secret_id, consumed_nonce)
	VALUES (v_secret_id, p_consumed_nonce)
	RETURNING id INTO v_nonce_id;
	RETURN v_nonce_id;
END;
$$;


--
-- Name: accounts_insert_nonce_secret_1(public.address, public.bytes32, integer, public.bytes16); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accounts_insert_nonce_secret_1(eoa_addr_ public.address, priv_key_ public.bytes32, nonce_ integer, salt_ public.bytes16) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
	PERFORM accounts_insert_nonce_1(eoa_addr_, nonce_);
	INSERT INTO accounts_secrets_1(eoa_addr, priv_key, salt)
	VALUES (eoa_addr_, priv_key_, salt_);
END;
$$;


--
-- Name: accounts_insert_nonce_secret_2(public.address, public.bytes32, integer, public.bytes16); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accounts_insert_nonce_secret_2(eoa_addr_ public.address, priv_key_ public.bytes32, nonce_ integer, salt_ public.bytes16) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
	PERFORM accounts_insert_nonce_2(eoa_addr_, nonce_);
	INSERT INTO accounts_secrets_1(eoa_addr, priv_key, salt)
	VALUES (eoa_addr_, priv_key_, salt_);
END;
$$;


--
-- Name: accounts_insert_nonce_secret_3(public.address, public.bytes32, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accounts_insert_nonce_secret_3(eoa_addr_ public.address, secret_ public.bytes32, nonce_ integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
	INSERT INTO accounts_secrets_nonces_2(eoa_addr, nonce) VALUES (eoa_addr_, nonce_);
	INSERT INTO accounts_secrets_2(eoa_addr, secret)
	VALUES (eoa_addr_, secret_);
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts_executed_transactions_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_executed_transactions_1 (
    id integer NOT NULL,
    eoa_addr public.address NOT NULL,
    transaction_hash public.hash NOT NULL
);


--
-- Name: accounts_executed_transactions_1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_executed_transactions_1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_executed_transactions_1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_executed_transactions_1_id_seq OWNED BY public.accounts_executed_transactions_1.id;


--
-- Name: accounts_executed_transactions_2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_executed_transactions_2 (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    eoa_addr public.address NOT NULL,
    transaction_hash public.hash NOT NULL,
    gas_limit integer NOT NULL,
    desc_ character varying NOT NULL
);


--
-- Name: accounts_executed_transactions_2_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_executed_transactions_2_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_executed_transactions_2_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_executed_transactions_2_id_seq OWNED BY public.accounts_executed_transactions_2.id;


--
-- Name: accounts_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: accounts_secrets_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_secrets_1 (
    id integer NOT NULL,
    eoa_addr public.address NOT NULL,
    priv_key public.bytes32 NOT NULL,
    salt public.bytes16 NOT NULL,
    valid_until timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '1 mon'::interval) NOT NULL
);


--
-- Name: accounts_secrets_1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_secrets_1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_secrets_1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_secrets_1_id_seq OWNED BY public.accounts_secrets_1.id;


--
-- Name: accounts_secrets_2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_secrets_2 (
    id integer NOT NULL,
    eoa_addr public.address NOT NULL,
    secret public.bytes32,
    valid_until timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '1 mon'::interval) NOT NULL
);


--
-- Name: accounts_secrets_2_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_secrets_2_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_secrets_2_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_secrets_2_id_seq OWNED BY public.accounts_secrets_2.id;


--
-- Name: accounts_secrets_nonces_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_secrets_nonces_1 (
    id integer NOT NULL,
    secret_id integer NOT NULL,
    consumed_nonce integer NOT NULL
);


--
-- Name: accounts_secrets_nonces_1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_secrets_nonces_1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_secrets_nonces_1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_secrets_nonces_1_id_seq OWNED BY public.accounts_secrets_nonces_1.id;


--
-- Name: accounts_secrets_nonces_2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_secrets_nonces_2 (
    id integer NOT NULL,
    eoa_addr public.address NOT NULL,
    nonce integer NOT NULL
);


--
-- Name: accounts_secrets_nonces_2_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_secrets_nonces_2_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_secrets_nonces_2_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_secrets_nonces_2_id_seq OWNED BY public.accounts_secrets_nonces_2.id;


--
-- Name: accounts_sender_keys_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_sender_keys_1 (
    id integer NOT NULL,
    private_key public.bytes32 NOT NULL,
    last_accessed timestamp without time zone
);


--
-- Name: accounts_sender_keys_1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_sender_keys_1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_sender_keys_1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_sender_keys_1_id_seq OWNED BY public.accounts_sender_keys_1.id;


--
-- Name: accounts_transaction_statistics_1; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.accounts_transaction_statistics_1 AS
 SELECT desc_ AS action,
    avg(
        CASE
            WHEN (created_at >= (now() - '24:00:00'::interval)) THEN gas_limit
            ELSE NULL::integer
        END) AS avg_gas_limit_24_hours,
    avg(
        CASE
            WHEN (created_at >= (now() - '7 days'::interval)) THEN gas_limit
            ELSE NULL::integer
        END) AS avg_gas_limit_week,
    avg(gas_limit) AS avg_gas_limit_all_time,
    (count(
        CASE
            WHEN (created_at >= (now() - '24:00:00'::interval)) THEN 1
            ELSE NULL::integer
        END))::integer AS tx_24_hours,
    (count(
        CASE
            WHEN (created_at >= (now() - '7 days'::interval)) THEN 1
            ELSE NULL::integer
        END))::integer AS tx_week,
    (count(*))::integer AS tx_all_time
   FROM public.accounts_executed_transactions_2
  GROUP BY desc_;


--
-- Name: florin_chain_blocks_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.florin_chain_blocks_1 (
    block_number bigint NOT NULL,
    block_hash public.hash NOT NULL,
    block_timestamp bigint NOT NULL,
    CONSTRAINT florin_chain_blocks_1_block_number_check CHECK ((block_number >= 0)),
    CONSTRAINT florin_chain_blocks_1_block_timestamp_check CHECK ((block_timestamp >= 0))
);


--
-- Name: liquity_events_active_pool_coll_balance_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_active_pool_coll_balance_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    coll_balance public.hugeint NOT NULL
);


--
-- Name: liquity_events_default_pool_coll_balance_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_default_pool_coll_balance_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    coll_balance public.hugeint NOT NULL
);


--
-- Name: florin_collateral_deposited_1; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.florin_collateral_deposited_1 AS
 WITH latest_active_pool AS (
         SELECT DISTINCT ON (liquity_events_active_pool_coll_balance_updated.emitter_addr) liquity_events_active_pool_coll_balance_updated.emitter_addr,
            liquity_events_active_pool_coll_balance_updated.coll_balance
           FROM public.liquity_events_active_pool_coll_balance_updated
          ORDER BY liquity_events_active_pool_coll_balance_updated.emitter_addr, liquity_events_active_pool_coll_balance_updated.block_number DESC, liquity_events_active_pool_coll_balance_updated.id DESC
        ), latest_default_pool AS (
         SELECT DISTINCT ON (liquity_events_default_pool_coll_balance_updated.emitter_addr) liquity_events_default_pool_coll_balance_updated.emitter_addr,
            liquity_events_default_pool_coll_balance_updated.coll_balance
           FROM public.liquity_events_default_pool_coll_balance_updated
          ORDER BY liquity_events_default_pool_coll_balance_updated.emitter_addr, liquity_events_default_pool_coll_balance_updated.block_number DESC, liquity_events_default_pool_coll_balance_updated.id DESC
        )
 SELECT (COALESCE(( SELECT sum((latest_active_pool.coll_balance)::numeric) AS sum
           FROM latest_active_pool), (0)::numeric) + COALESCE(( SELECT sum((latest_default_pool.coll_balance)::numeric) AS sum
           FROM latest_default_pool), (0)::numeric)) AS amount;


--
-- Name: florin_faucet_amounts_sent_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.florin_faucet_amounts_sent_1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    recipient public.address NOT NULL,
    x_handle character varying
);


--
-- Name: florin_faucet_amounts_sent_1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.florin_faucet_amounts_sent_1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: florin_faucet_amounts_sent_1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.florin_faucet_amounts_sent_1_id_seq OWNED BY public.florin_faucet_amounts_sent_1.id;


--
-- Name: florin_faucet_migrationst; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.florin_faucet_migrationst (
    version character varying(255) NOT NULL
);


--
-- Name: liquity_events_bold_token_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_bold_token_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_bold_token_address public.address NOT NULL
);


--
-- Name: liquity_events_bold_token_transfer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_bold_token_transfer (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    from_address public.address NOT NULL,
    to_address public.address NOT NULL,
    value public.hugeint NOT NULL
);


--
-- Name: florin_fusd_outstanding_1; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.florin_fusd_outstanding_1 AS
 SELECT COALESCE(sum(
        CASE
            WHEN ((from_address)::bpchar = '0x0000000000000000000000000000000000000000'::bpchar) THEN (value)::numeric
            WHEN ((to_address)::bpchar = '0x0000000000000000000000000000000000000000'::bpchar) THEN (- (value)::numeric)
            ELSE (0)::numeric
        END), (0)::numeric) AS amount
   FROM public.liquity_events_bold_token_transfer
  WHERE ((emitter_addr)::bpchar IN ( SELECT DISTINCT liquity_events_bold_token_address_changed.new_bold_token_address
           FROM public.liquity_events_bold_token_address_changed));


--
-- Name: florin_ingestor_checkpointing_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.florin_ingestor_checkpointing_1 (
    id integer NOT NULL,
    last_updated timestamp without time zone NOT NULL,
    block_number integer NOT NULL
);


--
-- Name: florin_ingestor_checkpointing_1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.florin_ingestor_checkpointing_1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: florin_ingestor_checkpointing_1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.florin_ingestor_checkpointing_1_id_seq OWNED BY public.florin_ingestor_checkpointing_1.id;


--
-- Name: florin_ingestor_checkpointing_1_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.florin_ingestor_checkpointing_1_testnet_v1 (
    id integer NOT NULL,
    last_updated timestamp without time zone NOT NULL,
    block_number integer NOT NULL
);


--
-- Name: florin_ingestor_checkpointing_1_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.florin_ingestor_checkpointing_1_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: florin_ingestor_checkpointing_1_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.florin_ingestor_checkpointing_1_testnet_v1_id_seq OWNED BY public.florin_ingestor_checkpointing_1_testnet_v1.id;


--
-- Name: florin_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.florin_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: liquity_events_batch_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_batch_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    interest_batch_manager public.address NOT NULL,
    operation integer NOT NULL,
    debt public.hugeint NOT NULL,
    coll public.hugeint NOT NULL,
    annual_interest_rate public.hugeint NOT NULL,
    annual_management_fee public.hugeint NOT NULL,
    total_debt_shares public.hugeint NOT NULL,
    debt_increase_from_upfront_fee public.hugeint NOT NULL
);


--
-- Name: liquity_events_batched_trove_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_batched_trove_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    interest_batch_manager public.address NOT NULL,
    batch_debt_shares public.hugeint NOT NULL,
    coll public.hugeint NOT NULL,
    stake public.hugeint NOT NULL,
    snapshot_of_total_coll_redist public.hugeint NOT NULL,
    snapshot_of_total_debt_redist public.hugeint NOT NULL
);


--
-- Name: liquity_events_trove_nft_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_nft_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_trove_nft_address public.address NOT NULL
);


--
-- Name: liquity_events_trove_nft_transfer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_nft_transfer (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    from_address public.address NOT NULL,
    to_address public.address NOT NULL,
    token_id public.hugeint NOT NULL
);


--
-- Name: liquity_events_trove_operation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_operation (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    operation integer NOT NULL,
    annual_interest_rate public.hugeint NOT NULL,
    debt_increase_from_redist public.hugeint NOT NULL,
    debt_increase_from_upfront_fee public.hugeint NOT NULL,
    debt_change_from_operation public.hugeint NOT NULL,
    coll_increase_from_redist public.hugeint NOT NULL,
    coll_change_from_operation public.hugeint NOT NULL
);


--
-- Name: liquity_events_trove_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    debt public.hugeint NOT NULL,
    coll public.hugeint NOT NULL,
    stake public.hugeint NOT NULL,
    annual_interest_rate public.hugeint NOT NULL,
    snapshot_of_total_coll_redist public.hugeint NOT NULL,
    snapshot_of_total_debt_redist public.hugeint NOT NULL
);


--
-- Name: florin_outstanding_positions_1; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.florin_outstanding_positions_1 AS
 WITH latest_operation AS (
         SELECT DISTINCT ON (liquity_events_trove_operation.emitter_addr, liquity_events_trove_operation.trove_id) liquity_events_trove_operation.id,
            liquity_events_trove_operation.block_hash,
            liquity_events_trove_operation.transaction_hash,
            liquity_events_trove_operation.block_number,
            liquity_events_trove_operation.emitter_addr,
            liquity_events_trove_operation.trove_id,
            liquity_events_trove_operation.operation,
            liquity_events_trove_operation.annual_interest_rate
           FROM public.liquity_events_trove_operation
          ORDER BY liquity_events_trove_operation.emitter_addr, liquity_events_trove_operation.trove_id, liquity_events_trove_operation.block_number DESC, liquity_events_trove_operation.id DESC
        ), latest_mode_change AS (
         SELECT DISTINCT ON (liquity_events_trove_operation.emitter_addr, liquity_events_trove_operation.trove_id) liquity_events_trove_operation.emitter_addr,
            liquity_events_trove_operation.trove_id,
            liquity_events_trove_operation.operation
           FROM public.liquity_events_trove_operation
          WHERE (liquity_events_trove_operation.operation = ANY (ARRAY[0, 1, 5, 7, 8, 9]))
          ORDER BY liquity_events_trove_operation.emitter_addr, liquity_events_trove_operation.trove_id, liquity_events_trove_operation.block_number DESC, liquity_events_trove_operation.id DESC
        ), latest_batch AS (
         SELECT DISTINCT ON (liquity_events_batch_updated.emitter_addr, liquity_events_batch_updated.interest_batch_manager) liquity_events_batch_updated.emitter_addr,
            liquity_events_batch_updated.interest_batch_manager,
            liquity_events_batch_updated.debt,
            liquity_events_batch_updated.annual_interest_rate,
            liquity_events_batch_updated.total_debt_shares
           FROM public.liquity_events_batch_updated
          ORDER BY liquity_events_batch_updated.emitter_addr, liquity_events_batch_updated.interest_batch_manager, liquity_events_batch_updated.block_number DESC, liquity_events_batch_updated.id DESC
        ), latest_batched_trove AS (
         SELECT DISTINCT ON (liquity_events_batched_trove_updated.emitter_addr, liquity_events_batched_trove_updated.trove_id) liquity_events_batched_trove_updated.emitter_addr,
            liquity_events_batched_trove_updated.trove_id,
            liquity_events_batched_trove_updated.interest_batch_manager,
            liquity_events_batched_trove_updated.batch_debt_shares
           FROM public.liquity_events_batched_trove_updated
          ORDER BY liquity_events_batched_trove_updated.emitter_addr, liquity_events_batched_trove_updated.trove_id, liquity_events_batched_trove_updated.block_number DESC, liquity_events_batched_trove_updated.id DESC
        ), latest_trove_nft AS (
         SELECT DISTINCT ON (liquity_events_trove_nft_address_changed.emitter_addr) liquity_events_trove_nft_address_changed.emitter_addr AS trove_manager,
            liquity_events_trove_nft_address_changed.new_trove_nft_address AS trove_nft
           FROM public.liquity_events_trove_nft_address_changed
          ORDER BY liquity_events_trove_nft_address_changed.emitter_addr, liquity_events_trove_nft_address_changed.block_number DESC, liquity_events_trove_nft_address_changed.id DESC
        ), latest_owner AS (
         SELECT DISTINCT ON (liquity_events_trove_nft_transfer.emitter_addr, liquity_events_trove_nft_transfer.token_id) liquity_events_trove_nft_transfer.emitter_addr AS trove_nft,
            liquity_events_trove_nft_transfer.token_id,
            liquity_events_trove_nft_transfer.to_address AS owner
           FROM public.liquity_events_trove_nft_transfer
          ORDER BY liquity_events_trove_nft_transfer.emitter_addr, liquity_events_trove_nft_transfer.token_id, liquity_events_trove_nft_transfer.block_number DESC, liquity_events_trove_nft_transfer.id DESC
        ), positions AS (
         SELECT o.block_hash,
            o.transaction_hash,
            o.block_number,
            o.emitter_addr AS trove_manager,
            o.trove_id,
            owner.owner,
                CASE
                    WHEN ((mode.operation = ANY (ARRAY[7, 8])) AND (b.trove_id IS NOT NULL)) THEN trunc((((batch.debt)::numeric * (b.batch_debt_shares)::numeric) / NULLIF((batch.total_debt_shares)::numeric, (0)::numeric)))
                    ELSE (t.debt)::numeric
                END AS debt,
            COALESCE(t.coll, b.coll) AS coll,
            COALESCE(t.stake, b.stake) AS stake,
                CASE
                    WHEN (mode.operation = ANY (ARRAY[7, 8])) THEN batch.annual_interest_rate
                    ELSE COALESCE(t.annual_interest_rate, o.annual_interest_rate)
                END AS annual_interest_rate,
            COALESCE(t.snapshot_of_total_coll_redist, b.snapshot_of_total_coll_redist) AS snapshot_of_total_coll_redist,
            COALESCE(t.snapshot_of_total_debt_redist, b.snapshot_of_total_debt_redist) AS snapshot_of_total_debt_redist,
                CASE
                    WHEN (mode.operation = ANY (ARRAY[7, 8])) THEN (batched.interest_batch_manager)::bpchar
                    ELSE NULL::bpchar
                END AS interest_batch_manager
           FROM (((((((latest_operation o
             JOIN latest_mode_change mode ON ((((mode.emitter_addr)::bpchar = (o.emitter_addr)::bpchar) AND ((mode.trove_id)::numeric = (o.trove_id)::numeric))))
             LEFT JOIN public.liquity_events_trove_updated t ON ((((t.emitter_addr)::bpchar = (o.emitter_addr)::bpchar) AND ((t.trove_id)::numeric = (o.trove_id)::numeric) AND ((t.transaction_hash)::bpchar = (o.transaction_hash)::bpchar))))
             LEFT JOIN public.liquity_events_batched_trove_updated b ON ((((b.emitter_addr)::bpchar = (o.emitter_addr)::bpchar) AND ((b.trove_id)::numeric = (o.trove_id)::numeric) AND ((b.transaction_hash)::bpchar = (o.transaction_hash)::bpchar))))
             LEFT JOIN latest_batched_trove batched ON ((((batched.emitter_addr)::bpchar = (o.emitter_addr)::bpchar) AND ((batched.trove_id)::numeric = (o.trove_id)::numeric))))
             LEFT JOIN latest_batch batch ON ((((batch.emitter_addr)::bpchar = (batched.emitter_addr)::bpchar) AND ((batch.interest_batch_manager)::bpchar = (batched.interest_batch_manager)::bpchar))))
             LEFT JOIN latest_trove_nft nft ON (((nft.trove_manager)::bpchar = (o.emitter_addr)::bpchar)))
             LEFT JOIN latest_owner owner ON ((((owner.trove_nft)::bpchar = (nft.trove_nft)::bpchar) AND ((owner.token_id)::numeric = (o.trove_id)::numeric))))
          WHERE (o.operation <> ALL (ARRAY[1, 5]))
        )
 SELECT block_hash,
    transaction_hash,
    block_number,
    trove_manager,
    trove_id,
    owner,
    debt,
    coll,
    stake,
    annual_interest_rate,
    snapshot_of_total_coll_redist,
    snapshot_of_total_debt_redist,
    interest_batch_manager
   FROM positions
  WHERE ((debt > (0)::numeric) AND ((coll)::numeric > (0)::numeric));


--
-- Name: liquity_events_stability_pool_bold_balance_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_stability_pool_bold_balance_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_balance public.hugeint NOT NULL
);


--
-- Name: florin_stability_pool_1; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.florin_stability_pool_1 AS
 WITH latest_stability_pool AS (
         SELECT DISTINCT ON (liquity_events_stability_pool_bold_balance_updated.emitter_addr) liquity_events_stability_pool_bold_balance_updated.emitter_addr,
            liquity_events_stability_pool_bold_balance_updated.new_balance
           FROM public.liquity_events_stability_pool_bold_balance_updated
          ORDER BY liquity_events_stability_pool_bold_balance_updated.emitter_addr, liquity_events_stability_pool_bold_balance_updated.block_number DESC, liquity_events_stability_pool_bold_balance_updated.id DESC
        )
 SELECT COALESCE(sum((new_balance)::numeric), (0)::numeric) AS amount
   FROM latest_stability_pool;


--
-- Name: florin_stability_pool_accounting_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.florin_stability_pool_accounting_1 (
    stability_pool public.address NOT NULL,
    block_number bigint NOT NULL,
    block_hash public.hash NOT NULL,
    p public.hugeint NOT NULL,
    scale public.hugeint NOT NULL,
    b public.hugeint NOT NULL,
    total_deposits public.hugeint NOT NULL,
    pending_yield public.hugeint NOT NULL,
    CONSTRAINT florin_stability_pool_accounting_1_b_check CHECK (((b)::numeric >= (0)::numeric)),
    CONSTRAINT florin_stability_pool_accounting_1_p_check CHECK (((p)::numeric > (0)::numeric)),
    CONSTRAINT florin_stability_pool_accounting_1_pending_yield_check CHECK (((pending_yield)::numeric >= (0)::numeric)),
    CONSTRAINT florin_stability_pool_accounting_1_scale_check CHECK (((scale)::numeric >= (0)::numeric)),
    CONSTRAINT florin_stability_pool_accounting_1_total_deposits_check CHECK (((total_deposits)::numeric >= (0)::numeric))
);


--
-- Name: liquity_events_b_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_b_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    b public.hugeint NOT NULL,
    scale public.hugeint NOT NULL
);


--
-- Name: liquity_events_p_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_p_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    p public.hugeint NOT NULL
);


--
-- Name: florin_stability_pool_apr_1; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.florin_stability_pool_apr_1 AS
 WITH pools AS (
         SELECT florin_stability_pool_accounting_1.stability_pool
           FROM public.florin_stability_pool_accounting_1
        UNION
         SELECT liquity_events_b_updated.emitter_addr
           FROM public.liquity_events_b_updated
        UNION
         SELECT liquity_events_stability_pool_bold_balance_updated.emitter_addr
           FROM public.liquity_events_stability_pool_bold_balance_updated
        ), latest AS (
         SELECT DISTINCT ON (florin_stability_pool_accounting_1.stability_pool) florin_stability_pool_accounting_1.stability_pool,
            florin_stability_pool_accounting_1.block_number,
            florin_stability_pool_accounting_1.block_hash,
            florin_stability_pool_accounting_1.p,
            florin_stability_pool_accounting_1.scale,
            florin_stability_pool_accounting_1.b,
            florin_stability_pool_accounting_1.total_deposits,
            florin_stability_pool_accounting_1.pending_yield
           FROM public.florin_stability_pool_accounting_1
          ORDER BY florin_stability_pool_accounting_1.stability_pool, florin_stability_pool_accounting_1.block_number DESC
        ), state AS (
         SELECT pools.stability_pool,
            s.block_number,
            s.block_hash,
            s.p,
            s.scale,
            h.block_timestamp AS as_of_timestamp,
            (h.block_timestamp - pace.block_timestamp) AS pace_seconds,
            checkpoint.block_number AS next_indexed_block,
            ((s.b)::numeric +
                CASE
                    WHEN (((s.total_deposits)::numeric > (0)::numeric) AND ((s.pending_yield)::numeric > (0)::numeric)) THEN div(((s.p)::numeric * (s.pending_yield)::numeric), (s.total_deposits)::numeric)
                    ELSE (0)::numeric
                END) AS effective_b
           FROM ((((pools
             LEFT JOIN latest s USING (stability_pool))
             LEFT JOIN public.florin_chain_blocks_1 h ON (((h.block_number = s.block_number) AND ((h.block_hash)::bpchar = (s.block_hash)::bpchar))))
             LEFT JOIN public.florin_chain_blocks_1 pace ON ((pace.block_number = (s.block_number - 100000))))
             LEFT JOIN public.florin_ingestor_checkpointing_1 checkpoint ON ((checkpoint.id = 1)))
        ), windows AS (
         SELECT s.stability_pool,
            s.block_number,
            s.block_hash,
            s.p,
            s.scale,
            s.as_of_timestamp,
            s.pace_seconds,
            s.next_indexed_block,
            s.effective_b,
            w.window_seconds,
            GREATEST((0)::numeric, ((s.block_number)::numeric - div(((((w.window_seconds)::numeric * (100000)::numeric) + (s.pace_seconds)::numeric) - (1)::numeric), (NULLIF(s.pace_seconds, 0))::numeric))) AS start_block,
            GREATEST((0)::numeric, ((s.block_number)::numeric - div(((((691200)::numeric * (100000)::numeric) + (s.pace_seconds)::numeric) - (1)::numeric), (NULLIF(s.pace_seconds, 0))::numeric))) AS from_block
           FROM (state s
             CROSS JOIN ( VALUES (86400), (604800)) w(window_seconds))
        ), baselines AS (
         SELECT w.stability_pool,
            w.block_number,
            w.block_hash,
            w.p,
            w.scale,
            w.as_of_timestamp,
            w.pace_seconds,
            w.next_indexed_block,
            w.effective_b,
            w.window_seconds,
            w.start_block,
            w.from_block,
            baseline.b AS baseline_b,
            baseline.scale AS baseline_scale,
            baseline.block_number AS baseline_block,
            baseline.block_hash AS baseline_hash,
            ((baseline.block_number)::numeric <= w.start_block) AS full_window,
            h.block_timestamp AS baseline_timestamp,
                CASE
                    WHEN (NOT (EXISTS ( SELECT 1
                       FROM public.liquity_events_p_updated e
                      WHERE (((e.emitter_addr)::bpchar = (w.stability_pool)::bpchar) AND (((e.block_number)::numeric >= w.from_block) AND (e.block_number <= w.block_number)))))) THEN w.p
                    ELSE starting_p.p
                END AS baseline_p
           FROM (((windows w
             LEFT JOIN LATERAL ( SELECT e.b,
                    e.scale,
                    e.block_number,
                    e.block_hash
                   FROM public.liquity_events_b_updated e
                  WHERE (((e.emitter_addr)::bpchar = (w.stability_pool)::bpchar) AND (((e.block_number)::numeric >= w.from_block) AND (e.block_number <= w.block_number)))
                  ORDER BY ((e.block_number)::numeric <= w.start_block) DESC,
                        CASE
                            WHEN ((e.block_number)::numeric <= w.start_block) THEN e.block_number
                            ELSE NULL::integer
                        END DESC,
                        CASE
                            WHEN ((e.block_number)::numeric <= w.start_block) THEN e.id
                            ELSE NULL::integer
                        END DESC, e.block_number, e.id
                 LIMIT 1) baseline ON (true))
             LEFT JOIN public.florin_chain_blocks_1 h ON (((h.block_number = baseline.block_number) AND ((h.block_hash)::bpchar = (baseline.block_hash)::bpchar))))
             LEFT JOIN LATERAL ( SELECT e.p
                   FROM public.liquity_events_p_updated e
                  WHERE (((e.emitter_addr)::bpchar = (w.stability_pool)::bpchar) AND (((e.block_number)::numeric >= w.from_block) AND (e.block_number <= baseline.block_number)))
                  ORDER BY e.block_number DESC, e.id DESC
                 LIMIT 1) starting_p ON (true))
        ), checked AS (
         SELECT baselines.stability_pool,
            baselines.block_number,
            baselines.block_hash,
            baselines.p,
            baselines.scale,
            baselines.as_of_timestamp,
            baselines.pace_seconds,
            baselines.next_indexed_block,
            baselines.effective_b,
            baselines.window_seconds,
            baselines.start_block,
            baselines.from_block,
            baselines.baseline_b,
            baselines.baseline_scale,
            baselines.baseline_block,
            baselines.baseline_hash,
            baselines.full_window,
            baselines.baseline_timestamp,
            baselines.baseline_p,
            (baselines.as_of_timestamp - baselines.baseline_timestamp) AS elapsed_seconds,
                CASE
                    WHEN (baselines.block_number IS NULL) THEN 'missing_snapshot'::text
                    WHEN ((baselines.next_indexed_block IS NULL) OR (baselines.next_indexed_block <= baselines.block_number)) THEN 'events_not_indexed'::text
                    WHEN (baselines.block_number <= 100000) THEN 'insufficient_chain_history'::text
                    WHEN (baselines.pace_seconds IS NULL) THEN 'missing_pace_block'::text
                    WHEN (baselines.pace_seconds <= 0) THEN 'invalid_block_pace'::text
                    WHEN (baselines.baseline_block IS NULL) THEN 'missing_baseline'::text
                    WHEN ((baselines.baseline_scale)::numeric <> (baselines.scale)::numeric) THEN 'scale_changed'::text
                    WHEN (baselines.baseline_p IS NULL) THEN 'unknown_baseline_p'::text
                    WHEN (baselines.baseline_timestamp IS NULL) THEN 'missing_baseline_timestamp'::text
                    WHEN (((baselines.baseline_p)::numeric <= (0)::numeric) OR (baselines.as_of_timestamp <= baselines.baseline_timestamp) OR (baselines.effective_b < (baselines.baseline_b)::numeric)) THEN 'invalid_return'::text
                    WHEN ((NOT baselines.full_window) AND ((baselines.as_of_timestamp - baselines.baseline_timestamp) < (baselines.window_seconds / 2))) THEN 'insufficient_history'::text
                    ELSE 'ok'::text
                END AS status
           FROM baselines
        ), returns AS (
         SELECT checked.stability_pool,
            checked.block_number,
            checked.block_hash,
            checked.p,
            checked.scale,
            checked.as_of_timestamp,
            checked.pace_seconds,
            checked.next_indexed_block,
            checked.effective_b,
            checked.window_seconds,
            checked.start_block,
            checked.from_block,
            checked.baseline_b,
            checked.baseline_scale,
            checked.baseline_block,
            checked.baseline_hash,
            checked.full_window,
            checked.baseline_timestamp,
            checked.baseline_p,
            checked.elapsed_seconds,
            checked.status,
                CASE
                    WHEN (checked.status = 'ok'::text) THEN (((div(((checked.effective_b - (checked.baseline_b)::numeric) * ('1000000000000'::bigint)::numeric), NULLIF((checked.baseline_p)::numeric, (0)::numeric)) * (31536000)::numeric) / ('1000000000000'::bigint)::numeric) / (NULLIF(checked.elapsed_seconds, 0))::numeric)
                    ELSE NULL::numeric
                END AS apr
           FROM checked
        )
 SELECT stability_pool,
    block_number AS as_of_block,
    block_hash AS as_of_block_hash,
    as_of_timestamp,
    max(apr) FILTER (WHERE (window_seconds = 86400)) AS apr_24h,
    max(apr) FILTER (WHERE (window_seconds = 604800)) AS apr_7d,
    max(baseline_timestamp) FILTER (WHERE (window_seconds = 86400)) AS baseline_24h_timestamp,
    max(baseline_timestamp) FILTER (WHERE (window_seconds = 604800)) AS baseline_7d_timestamp,
    max(status) FILTER (WHERE (window_seconds = 86400)) AS status_24h,
    max(status) FILTER (WHERE (window_seconds = 604800)) AS status_7d
   FROM returns
  GROUP BY stability_pool, block_number, block_hash, as_of_timestamp;


--
-- Name: florin_stability_pool_apr_history_1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.florin_stability_pool_apr_history_1 (
    id bigint NOT NULL,
    recorded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    stability_pool public.address NOT NULL,
    as_of_block bigint,
    as_of_block_hash public.hash,
    as_of_timestamp bigint,
    apr_24h numeric,
    apr_7d numeric,
    baseline_24h_timestamp bigint,
    baseline_7d_timestamp bigint,
    status_24h text NOT NULL,
    status_7d text NOT NULL
);


--
-- Name: COLUMN florin_stability_pool_apr_history_1.apr_24h; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.florin_stability_pool_apr_history_1.apr_24h IS 'Annualised decimal fraction, not a percentage: 0.05 means 5%. NULL means unavailable.';


--
-- Name: COLUMN florin_stability_pool_apr_history_1.apr_7d; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.florin_stability_pool_apr_history_1.apr_7d IS 'Annualised decimal fraction, not a percentage: 0.05 means 5%. NULL means unavailable.';


--
-- Name: florin_stability_pool_apr_history_1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.florin_stability_pool_apr_history_1_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: florin_stability_pool_apr_history_1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.florin_stability_pool_apr_history_1_id_seq OWNED BY public.florin_stability_pool_apr_history_1.id;


--
-- Name: liquity_events_active_pool_address_added; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_active_pool_address_added (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_active_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_active_pool_address_added_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_active_pool_address_added_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_active_pool_address_added_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_active_pool_address_added_id_seq OWNED BY public.liquity_events_active_pool_address_added.id;


--
-- Name: liquity_events_active_pool_address_added_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_active_pool_address_added_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_active_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_active_pool_address_added_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_active_pool_address_added_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_active_pool_address_added_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_active_pool_address_added_testnet_v1_id_seq OWNED BY public.liquity_events_active_pool_address_added_testnet_v1.id;


--
-- Name: liquity_events_active_pool_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_active_pool_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_active_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_active_pool_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_active_pool_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_active_pool_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_active_pool_address_changed_id_seq OWNED BY public.liquity_events_active_pool_address_changed.id;


--
-- Name: liquity_events_active_pool_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_active_pool_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_active_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_active_pool_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_active_pool_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_active_pool_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_active_pool_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_active_pool_address_changed_testnet_v1.id;


--
-- Name: liquity_events_active_pool_bold_debt_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_active_pool_bold_debt_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    recorded_debt_sum public.hugeint NOT NULL
);


--
-- Name: liquity_events_active_pool_bold_debt_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_active_pool_bold_debt_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_active_pool_bold_debt_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_active_pool_bold_debt_updated_id_seq OWNED BY public.liquity_events_active_pool_bold_debt_updated.id;


--
-- Name: liquity_events_active_pool_bold_debt_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_active_pool_bold_debt_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    recorded_debt_sum public.hugeint NOT NULL
);


--
-- Name: liquity_events_active_pool_bold_debt_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_active_pool_bold_debt_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_active_pool_bold_debt_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_active_pool_bold_debt_updated_testnet_v1_id_seq OWNED BY public.liquity_events_active_pool_bold_debt_updated_testnet_v1.id;


--
-- Name: liquity_events_active_pool_coll_balance_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_active_pool_coll_balance_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_active_pool_coll_balance_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_active_pool_coll_balance_updated_id_seq OWNED BY public.liquity_events_active_pool_coll_balance_updated.id;


--
-- Name: liquity_events_active_pool_coll_balance_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_active_pool_coll_balance_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    coll_balance public.hugeint NOT NULL
);


--
-- Name: liquity_events_active_pool_coll_balance_updated_testnet__id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_active_pool_coll_balance_updated_testnet__id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_active_pool_coll_balance_updated_testnet__id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_active_pool_coll_balance_updated_testnet__id_seq OWNED BY public.liquity_events_active_pool_coll_balance_updated_testnet_v1.id;


--
-- Name: liquity_events_add_manager_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_add_manager_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    new_add_manager public.address NOT NULL
);


--
-- Name: liquity_events_add_manager_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_add_manager_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_add_manager_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_add_manager_updated_id_seq OWNED BY public.liquity_events_add_manager_updated.id;


--
-- Name: liquity_events_add_manager_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_add_manager_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    new_add_manager public.address NOT NULL
);


--
-- Name: liquity_events_add_manager_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_add_manager_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_add_manager_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_add_manager_updated_testnet_v1_id_seq OWNED BY public.liquity_events_add_manager_updated_testnet_v1.id;


--
-- Name: liquity_events_b_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_b_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_b_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_b_updated_id_seq OWNED BY public.liquity_events_b_updated.id;


--
-- Name: liquity_events_b_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_b_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    b public.hugeint NOT NULL,
    scale public.hugeint NOT NULL
);


--
-- Name: liquity_events_b_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_b_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_b_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_b_updated_testnet_v1_id_seq OWNED BY public.liquity_events_b_updated_testnet_v1.id;


--
-- Name: liquity_events_base_rate_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_base_rate_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    base_rate public.hugeint NOT NULL
);


--
-- Name: liquity_events_base_rate_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_base_rate_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_base_rate_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_base_rate_updated_id_seq OWNED BY public.liquity_events_base_rate_updated.id;


--
-- Name: liquity_events_base_rate_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_base_rate_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    base_rate public.hugeint NOT NULL
);


--
-- Name: liquity_events_base_rate_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_base_rate_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_base_rate_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_base_rate_updated_testnet_v1_id_seq OWNED BY public.liquity_events_base_rate_updated_testnet_v1.id;


--
-- Name: liquity_events_batch_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_batch_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_batch_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_batch_updated_id_seq OWNED BY public.liquity_events_batch_updated.id;


--
-- Name: liquity_events_batch_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_batch_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    interest_batch_manager public.address NOT NULL,
    operation integer NOT NULL,
    debt public.hugeint NOT NULL,
    coll public.hugeint NOT NULL,
    annual_interest_rate public.hugeint NOT NULL,
    annual_management_fee public.hugeint NOT NULL,
    total_debt_shares public.hugeint NOT NULL,
    debt_increase_from_upfront_fee public.hugeint NOT NULL
);


--
-- Name: liquity_events_batch_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_batch_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_batch_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_batch_updated_testnet_v1_id_seq OWNED BY public.liquity_events_batch_updated_testnet_v1.id;


--
-- Name: liquity_events_batched_trove_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_batched_trove_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_batched_trove_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_batched_trove_updated_id_seq OWNED BY public.liquity_events_batched_trove_updated.id;


--
-- Name: liquity_events_batched_trove_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_batched_trove_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    interest_batch_manager public.address NOT NULL,
    batch_debt_shares public.hugeint NOT NULL,
    coll public.hugeint NOT NULL,
    stake public.hugeint NOT NULL,
    snapshot_of_total_coll_redist public.hugeint NOT NULL,
    snapshot_of_total_debt_redist public.hugeint NOT NULL
);


--
-- Name: liquity_events_batched_trove_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_batched_trove_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_batched_trove_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_batched_trove_updated_testnet_v1_id_seq OWNED BY public.liquity_events_batched_trove_updated_testnet_v1.id;


--
-- Name: liquity_events_bold_token_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_bold_token_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_bold_token_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_bold_token_address_changed_id_seq OWNED BY public.liquity_events_bold_token_address_changed.id;


--
-- Name: liquity_events_bold_token_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_bold_token_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_bold_token_address public.address NOT NULL
);


--
-- Name: liquity_events_bold_token_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_bold_token_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_bold_token_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_bold_token_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_bold_token_address_changed_testnet_v1.id;


--
-- Name: liquity_events_bold_token_approval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_bold_token_approval (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    owner public.address NOT NULL,
    spender public.address NOT NULL,
    value public.hugeint NOT NULL
);


--
-- Name: liquity_events_bold_token_approval_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_bold_token_approval_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_bold_token_approval_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_bold_token_approval_id_seq OWNED BY public.liquity_events_bold_token_approval.id;


--
-- Name: liquity_events_bold_token_approval_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_bold_token_approval_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    owner public.address NOT NULL,
    spender public.address NOT NULL,
    value public.hugeint NOT NULL
);


--
-- Name: liquity_events_bold_token_approval_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_bold_token_approval_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_bold_token_approval_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_bold_token_approval_testnet_v1_id_seq OWNED BY public.liquity_events_bold_token_approval_testnet_v1.id;


--
-- Name: liquity_events_bold_token_transfer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_bold_token_transfer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_bold_token_transfer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_bold_token_transfer_id_seq OWNED BY public.liquity_events_bold_token_transfer.id;


--
-- Name: liquity_events_bold_token_transfer_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_bold_token_transfer_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    from_address public.address NOT NULL,
    to_address public.address NOT NULL,
    value public.hugeint NOT NULL
);


--
-- Name: liquity_events_bold_token_transfer_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_bold_token_transfer_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_bold_token_transfer_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_bold_token_transfer_testnet_v1_id_seq OWNED BY public.liquity_events_bold_token_transfer_testnet_v1.id;


--
-- Name: liquity_events_borrower_operations_address_added; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_borrower_operations_address_added (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_borrower_operations_address public.address NOT NULL
);


--
-- Name: liquity_events_borrower_operations_address_added_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_borrower_operations_address_added_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_borrower_operations_address_added_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_borrower_operations_address_added_id_seq OWNED BY public.liquity_events_borrower_operations_address_added.id;


--
-- Name: liquity_events_borrower_operations_address_added_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_borrower_operations_address_added_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_borrower_operations_address public.address NOT NULL
);


--
-- Name: liquity_events_borrower_operations_address_added_testnet_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_borrower_operations_address_added_testnet_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_borrower_operations_address_added_testnet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_borrower_operations_address_added_testnet_id_seq OWNED BY public.liquity_events_borrower_operations_address_added_testnet_v1.id;


--
-- Name: liquity_events_borrower_operations_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_borrower_operations_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_borrower_operations_address public.address NOT NULL
);


--
-- Name: liquity_events_borrower_operations_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_borrower_operations_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_borrower_operations_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_borrower_operations_address_changed_id_seq OWNED BY public.liquity_events_borrower_operations_address_changed.id;


--
-- Name: liquity_events_borrower_operations_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_borrower_operations_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_borrower_operations_address public.address NOT NULL
);


--
-- Name: liquity_events_borrower_operations_address_changed_testn_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_borrower_operations_address_changed_testn_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_borrower_operations_address_changed_testn_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_borrower_operations_address_changed_testn_id_seq OWNED BY public.liquity_events_borrower_operations_address_changed_testnet_v1.id;


--
-- Name: liquity_events_coll_balance_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_coll_balance_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    account public.address NOT NULL,
    new_balance public.hugeint NOT NULL
);


--
-- Name: liquity_events_coll_balance_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_coll_balance_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_coll_balance_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_coll_balance_updated_id_seq OWNED BY public.liquity_events_coll_balance_updated.id;


--
-- Name: liquity_events_coll_balance_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_coll_balance_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    account public.address NOT NULL,
    new_balance public.hugeint NOT NULL
);


--
-- Name: liquity_events_coll_balance_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_coll_balance_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_coll_balance_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_coll_balance_updated_testnet_v1_id_seq OWNED BY public.liquity_events_coll_balance_updated_testnet_v1.id;


--
-- Name: liquity_events_coll_sent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_coll_sent (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    to_address public.address NOT NULL,
    amount public.hugeint NOT NULL
);


--
-- Name: liquity_events_coll_sent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_coll_sent_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_coll_sent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_coll_sent_id_seq OWNED BY public.liquity_events_coll_sent.id;


--
-- Name: liquity_events_coll_sent_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_coll_sent_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    to_address public.address NOT NULL,
    amount public.hugeint NOT NULL
);


--
-- Name: liquity_events_coll_sent_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_coll_sent_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_coll_sent_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_coll_sent_testnet_v1_id_seq OWNED BY public.liquity_events_coll_sent_testnet_v1.id;


--
-- Name: liquity_events_coll_surplus_pool_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_coll_surplus_pool_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    coll_surplus_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_coll_surplus_pool_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_coll_surplus_pool_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_coll_surplus_pool_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_coll_surplus_pool_address_changed_id_seq OWNED BY public.liquity_events_coll_surplus_pool_address_changed.id;


--
-- Name: liquity_events_coll_surplus_pool_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_coll_surplus_pool_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    coll_surplus_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_coll_surplus_pool_address_changed_testnet_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_coll_surplus_pool_address_changed_testnet_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_coll_surplus_pool_address_changed_testnet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_coll_surplus_pool_address_changed_testnet_id_seq OWNED BY public.liquity_events_coll_surplus_pool_address_changed_testnet_v1.id;


--
-- Name: liquity_events_coll_token_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_coll_token_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_coll_token_address public.address NOT NULL
);


--
-- Name: liquity_events_coll_token_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_coll_token_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_coll_token_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_coll_token_address_changed_id_seq OWNED BY public.liquity_events_coll_token_address_changed.id;


--
-- Name: liquity_events_coll_token_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_coll_token_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_coll_token_address public.address NOT NULL
);


--
-- Name: liquity_events_coll_token_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_coll_token_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_coll_token_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_coll_token_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_coll_token_address_changed_testnet_v1.id;


--
-- Name: liquity_events_collateral_registry_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_collateral_registry_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    collateral_registry_address public.address NOT NULL
);


--
-- Name: liquity_events_collateral_registry_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_collateral_registry_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_collateral_registry_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_collateral_registry_address_changed_id_seq OWNED BY public.liquity_events_collateral_registry_address_changed.id;


--
-- Name: liquity_events_collateral_registry_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_collateral_registry_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    collateral_registry_address public.address NOT NULL
);


--
-- Name: liquity_events_collateral_registry_address_changed_testn_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_collateral_registry_address_changed_testn_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_collateral_registry_address_changed_testn_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_collateral_registry_address_changed_testn_id_seq OWNED BY public.liquity_events_collateral_registry_address_changed_testnet_v1.id;


--
-- Name: liquity_events_default_pool_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_default_pool_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_default_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_default_pool_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_default_pool_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_default_pool_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_default_pool_address_changed_id_seq OWNED BY public.liquity_events_default_pool_address_changed.id;


--
-- Name: liquity_events_default_pool_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_default_pool_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_default_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_default_pool_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_default_pool_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_default_pool_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_default_pool_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_default_pool_address_changed_testnet_v1.id;


--
-- Name: liquity_events_default_pool_bold_debt_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_default_pool_bold_debt_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    bold_debt public.hugeint NOT NULL
);


--
-- Name: liquity_events_default_pool_bold_debt_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_default_pool_bold_debt_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_default_pool_bold_debt_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_default_pool_bold_debt_updated_id_seq OWNED BY public.liquity_events_default_pool_bold_debt_updated.id;


--
-- Name: liquity_events_default_pool_bold_debt_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_default_pool_bold_debt_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    bold_debt public.hugeint NOT NULL
);


--
-- Name: liquity_events_default_pool_bold_debt_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_default_pool_bold_debt_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_default_pool_bold_debt_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_default_pool_bold_debt_updated_testnet_v1_id_seq OWNED BY public.liquity_events_default_pool_bold_debt_updated_testnet_v1.id;


--
-- Name: liquity_events_default_pool_coll_balance_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_default_pool_coll_balance_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_default_pool_coll_balance_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_default_pool_coll_balance_updated_id_seq OWNED BY public.liquity_events_default_pool_coll_balance_updated.id;


--
-- Name: liquity_events_default_pool_coll_balance_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_default_pool_coll_balance_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    coll_balance public.hugeint NOT NULL
);


--
-- Name: liquity_events_default_pool_coll_balance_updated_testnet_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_default_pool_coll_balance_updated_testnet_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_default_pool_coll_balance_updated_testnet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_default_pool_coll_balance_updated_testnet_id_seq OWNED BY public.liquity_events_default_pool_coll_balance_updated_testnet_v1.id;


--
-- Name: liquity_events_deposit_operation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_deposit_operation (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    depositor public.address NOT NULL,
    operation integer NOT NULL,
    deposit_loss_since_last_operation public.hugeint NOT NULL,
    top_up_or_withdrawal public.hugeint NOT NULL,
    yield_gain_since_last_operation public.hugeint NOT NULL,
    yield_gain_claimed public.hugeint NOT NULL,
    eth_gain_since_last_operation public.hugeint NOT NULL,
    eth_gain_claimed public.hugeint NOT NULL
);


--
-- Name: liquity_events_deposit_operation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_deposit_operation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_deposit_operation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_deposit_operation_id_seq OWNED BY public.liquity_events_deposit_operation.id;


--
-- Name: liquity_events_deposit_operation_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_deposit_operation_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    depositor public.address NOT NULL,
    operation integer NOT NULL,
    deposit_loss_since_last_operation public.hugeint NOT NULL,
    top_up_or_withdrawal public.hugeint NOT NULL,
    yield_gain_since_last_operation public.hugeint NOT NULL,
    yield_gain_claimed public.hugeint NOT NULL,
    eth_gain_since_last_operation public.hugeint NOT NULL,
    eth_gain_claimed public.hugeint NOT NULL
);


--
-- Name: liquity_events_deposit_operation_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_deposit_operation_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_deposit_operation_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_deposit_operation_testnet_v1_id_seq OWNED BY public.liquity_events_deposit_operation_testnet_v1.id;


--
-- Name: liquity_events_deposit_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_deposit_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    depositor public.address NOT NULL,
    new_deposit public.hugeint NOT NULL,
    stashed_coll public.hugeint NOT NULL,
    snapshot_p public.hugeint NOT NULL,
    snapshot_s public.hugeint NOT NULL,
    snapshot_b public.hugeint NOT NULL,
    snapshot_scale public.hugeint NOT NULL
);


--
-- Name: liquity_events_deposit_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_deposit_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_deposit_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_deposit_updated_id_seq OWNED BY public.liquity_events_deposit_updated.id;


--
-- Name: liquity_events_deposit_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_deposit_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    depositor public.address NOT NULL,
    new_deposit public.hugeint NOT NULL,
    stashed_coll public.hugeint NOT NULL,
    snapshot_p public.hugeint NOT NULL,
    snapshot_s public.hugeint NOT NULL,
    snapshot_b public.hugeint NOT NULL,
    snapshot_scale public.hugeint NOT NULL
);


--
-- Name: liquity_events_deposit_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_deposit_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_deposit_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_deposit_updated_testnet_v1_id_seq OWNED BY public.liquity_events_deposit_updated_testnet_v1.id;


--
-- Name: liquity_events_gas_pool_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_gas_pool_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    gas_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_gas_pool_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_gas_pool_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_gas_pool_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_gas_pool_address_changed_id_seq OWNED BY public.liquity_events_gas_pool_address_changed.id;


--
-- Name: liquity_events_gas_pool_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_gas_pool_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    gas_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_gas_pool_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_gas_pool_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_gas_pool_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_gas_pool_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_gas_pool_address_changed_testnet_v1.id;


--
-- Name: liquity_events_hint_helpers_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_hint_helpers_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    hint_helpers_address public.address NOT NULL
);


--
-- Name: liquity_events_hint_helpers_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_hint_helpers_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_hint_helpers_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_hint_helpers_address_changed_id_seq OWNED BY public.liquity_events_hint_helpers_address_changed.id;


--
-- Name: liquity_events_hint_helpers_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_hint_helpers_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    hint_helpers_address public.address NOT NULL
);


--
-- Name: liquity_events_hint_helpers_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_hint_helpers_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_hint_helpers_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_hint_helpers_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_hint_helpers_address_changed_testnet_v1.id;


--
-- Name: liquity_events_interest_router_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_interest_router_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    interest_router_address public.address NOT NULL
);


--
-- Name: liquity_events_interest_router_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_interest_router_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_interest_router_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_interest_router_address_changed_id_seq OWNED BY public.liquity_events_interest_router_address_changed.id;


--
-- Name: liquity_events_interest_router_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_interest_router_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    interest_router_address public.address NOT NULL
);


--
-- Name: liquity_events_interest_router_address_changed_testnet_v_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_interest_router_address_changed_testnet_v_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_interest_router_address_changed_testnet_v_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_interest_router_address_changed_testnet_v_id_seq OWNED BY public.liquity_events_interest_router_address_changed_testnet_v1.id;


--
-- Name: liquity_events_last_fee_op_time_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_last_fee_op_time_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    last_fee_op_time public.hugeint NOT NULL
);


--
-- Name: liquity_events_last_fee_op_time_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_last_fee_op_time_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_last_fee_op_time_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_last_fee_op_time_updated_id_seq OWNED BY public.liquity_events_last_fee_op_time_updated.id;


--
-- Name: liquity_events_last_fee_op_time_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_last_fee_op_time_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    last_fee_op_time public.hugeint NOT NULL
);


--
-- Name: liquity_events_last_fee_op_time_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_last_fee_op_time_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_last_fee_op_time_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_last_fee_op_time_updated_testnet_v1_id_seq OWNED BY public.liquity_events_last_fee_op_time_updated_testnet_v1.id;


--
-- Name: liquity_events_last_good_price_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_last_good_price_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    last_good_price public.hugeint NOT NULL
);


--
-- Name: liquity_events_last_good_price_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_last_good_price_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_last_good_price_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_last_good_price_updated_id_seq OWNED BY public.liquity_events_last_good_price_updated.id;


--
-- Name: liquity_events_last_good_price_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_last_good_price_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    last_good_price public.hugeint NOT NULL
);


--
-- Name: liquity_events_last_good_price_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_last_good_price_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_last_good_price_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_last_good_price_updated_testnet_v1_id_seq OWNED BY public.liquity_events_last_good_price_updated_testnet_v1.id;


--
-- Name: liquity_events_liquidation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_liquidation (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    debt_offset_by_sp public.hugeint NOT NULL,
    debt_redistributed public.hugeint NOT NULL,
    bold_gas_compensation public.hugeint NOT NULL,
    coll_gas_compensation public.hugeint NOT NULL,
    coll_sent_to_sp public.hugeint NOT NULL,
    coll_redistributed public.hugeint NOT NULL,
    coll_surplus public.hugeint NOT NULL,
    l_eth public.hugeint NOT NULL,
    l_bold_debt public.hugeint NOT NULL,
    price public.hugeint NOT NULL
);


--
-- Name: liquity_events_liquidation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_liquidation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_liquidation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_liquidation_id_seq OWNED BY public.liquity_events_liquidation.id;


--
-- Name: liquity_events_liquidation_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_liquidation_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    debt_offset_by_sp public.hugeint NOT NULL,
    debt_redistributed public.hugeint NOT NULL,
    bold_gas_compensation public.hugeint NOT NULL,
    coll_gas_compensation public.hugeint NOT NULL,
    coll_sent_to_sp public.hugeint NOT NULL,
    coll_redistributed public.hugeint NOT NULL,
    coll_surplus public.hugeint NOT NULL,
    l_eth public.hugeint NOT NULL,
    l_bold_debt public.hugeint NOT NULL,
    price public.hugeint NOT NULL
);


--
-- Name: liquity_events_liquidation_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_liquidation_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_liquidation_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_liquidation_testnet_v1_id_seq OWNED BY public.liquity_events_liquidation_testnet_v1.id;


--
-- Name: liquity_events_metadata_nft_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_metadata_nft_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    metadata_nft_address public.address NOT NULL
);


--
-- Name: liquity_events_metadata_nft_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_metadata_nft_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_metadata_nft_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_metadata_nft_address_changed_id_seq OWNED BY public.liquity_events_metadata_nft_address_changed.id;


--
-- Name: liquity_events_metadata_nft_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_metadata_nft_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    metadata_nft_address public.address NOT NULL
);


--
-- Name: liquity_events_metadata_nft_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_metadata_nft_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_metadata_nft_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_metadata_nft_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_metadata_nft_address_changed_testnet_v1.id;


--
-- Name: liquity_events_multi_trove_getter_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_multi_trove_getter_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    multi_trove_getter_address public.address NOT NULL
);


--
-- Name: liquity_events_multi_trove_getter_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_multi_trove_getter_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_multi_trove_getter_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_multi_trove_getter_address_changed_id_seq OWNED BY public.liquity_events_multi_trove_getter_address_changed.id;


--
-- Name: liquity_events_multi_trove_getter_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_multi_trove_getter_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    multi_trove_getter_address public.address NOT NULL
);


--
-- Name: liquity_events_multi_trove_getter_address_changed_testne_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_multi_trove_getter_address_changed_testne_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_multi_trove_getter_address_changed_testne_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_multi_trove_getter_address_changed_testne_id_seq OWNED BY public.liquity_events_multi_trove_getter_address_changed_testnet_v1.id;


--
-- Name: liquity_events_ownership_transferred; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_ownership_transferred (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    previous_owner public.address NOT NULL,
    new_owner public.address NOT NULL
);


--
-- Name: liquity_events_ownership_transferred_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_ownership_transferred_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_ownership_transferred_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_ownership_transferred_id_seq OWNED BY public.liquity_events_ownership_transferred.id;


--
-- Name: liquity_events_ownership_transferred_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_ownership_transferred_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    previous_owner public.address NOT NULL,
    new_owner public.address NOT NULL
);


--
-- Name: liquity_events_ownership_transferred_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_ownership_transferred_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_ownership_transferred_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_ownership_transferred_testnet_v1_id_seq OWNED BY public.liquity_events_ownership_transferred_testnet_v1.id;


--
-- Name: liquity_events_p_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_p_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_p_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_p_updated_id_seq OWNED BY public.liquity_events_p_updated.id;


--
-- Name: liquity_events_p_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_p_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    p public.hugeint NOT NULL
);


--
-- Name: liquity_events_p_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_p_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_p_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_p_updated_testnet_v1_id_seq OWNED BY public.liquity_events_p_updated_testnet_v1.id;


--
-- Name: liquity_events_price_feed_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_price_feed_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_price_feed_address public.address NOT NULL
);


--
-- Name: liquity_events_price_feed_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_price_feed_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_price_feed_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_price_feed_address_changed_id_seq OWNED BY public.liquity_events_price_feed_address_changed.id;


--
-- Name: liquity_events_price_feed_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_price_feed_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_price_feed_address public.address NOT NULL
);


--
-- Name: liquity_events_price_feed_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_price_feed_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_price_feed_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_price_feed_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_price_feed_address_changed_testnet_v1.id;


--
-- Name: liquity_events_redemption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_redemption (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    attempted_bold_amount public.hugeint NOT NULL,
    actual_bold_amount public.hugeint NOT NULL,
    eth_sent public.hugeint NOT NULL,
    eth_fee public.hugeint NOT NULL,
    price public.hugeint NOT NULL,
    redemption_price public.hugeint NOT NULL
);


--
-- Name: liquity_events_redemption_fee_paid_to_trove; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_redemption_fee_paid_to_trove (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    eth_fee public.hugeint NOT NULL
);


--
-- Name: liquity_events_redemption_fee_paid_to_trove_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_redemption_fee_paid_to_trove_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_redemption_fee_paid_to_trove_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_redemption_fee_paid_to_trove_id_seq OWNED BY public.liquity_events_redemption_fee_paid_to_trove.id;


--
-- Name: liquity_events_redemption_fee_paid_to_trove_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_redemption_fee_paid_to_trove_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    eth_fee public.hugeint NOT NULL
);


--
-- Name: liquity_events_redemption_fee_paid_to_trove_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_redemption_fee_paid_to_trove_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_redemption_fee_paid_to_trove_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_redemption_fee_paid_to_trove_testnet_v1_id_seq OWNED BY public.liquity_events_redemption_fee_paid_to_trove_testnet_v1.id;


--
-- Name: liquity_events_redemption_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_redemption_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_redemption_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_redemption_id_seq OWNED BY public.liquity_events_redemption.id;


--
-- Name: liquity_events_redemption_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_redemption_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    attempted_bold_amount public.hugeint NOT NULL,
    actual_bold_amount public.hugeint NOT NULL,
    eth_sent public.hugeint NOT NULL,
    eth_fee public.hugeint NOT NULL,
    price public.hugeint NOT NULL,
    redemption_price public.hugeint NOT NULL
);


--
-- Name: liquity_events_redemption_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_redemption_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_redemption_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_redemption_testnet_v1_id_seq OWNED BY public.liquity_events_redemption_testnet_v1.id;


--
-- Name: liquity_events_remove_manager_and_receiver_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_remove_manager_and_receiver_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    new_remove_manager public.address NOT NULL,
    new_receiver public.address NOT NULL
);


--
-- Name: liquity_events_remove_manager_and_receiver_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_remove_manager_and_receiver_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_remove_manager_and_receiver_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_remove_manager_and_receiver_updated_id_seq OWNED BY public.liquity_events_remove_manager_and_receiver_updated.id;


--
-- Name: liquity_events_remove_manager_and_receiver_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_remove_manager_and_receiver_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    new_remove_manager public.address NOT NULL,
    new_receiver public.address NOT NULL
);


--
-- Name: liquity_events_remove_manager_and_receiver_updated_testn_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_remove_manager_and_receiver_updated_testn_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_remove_manager_and_receiver_updated_testn_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_remove_manager_and_receiver_updated_testn_id_seq OWNED BY public.liquity_events_remove_manager_and_receiver_updated_testnet_v1.id;


--
-- Name: liquity_events_s_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_s_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    s public.hugeint NOT NULL,
    scale public.hugeint NOT NULL
);


--
-- Name: liquity_events_s_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_s_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_s_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_s_updated_id_seq OWNED BY public.liquity_events_s_updated.id;


--
-- Name: liquity_events_s_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_s_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    s public.hugeint NOT NULL,
    scale public.hugeint NOT NULL
);


--
-- Name: liquity_events_s_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_s_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_s_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_s_updated_testnet_v1_id_seq OWNED BY public.liquity_events_s_updated_testnet_v1.id;


--
-- Name: liquity_events_scale_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_scale_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    current_scale public.hugeint NOT NULL
);


--
-- Name: liquity_events_scale_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_scale_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_scale_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_scale_updated_id_seq OWNED BY public.liquity_events_scale_updated.id;


--
-- Name: liquity_events_scale_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_scale_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    current_scale public.hugeint NOT NULL
);


--
-- Name: liquity_events_scale_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_scale_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_scale_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_scale_updated_testnet_v1_id_seq OWNED BY public.liquity_events_scale_updated_testnet_v1.id;


--
-- Name: liquity_events_shut_down_from_oracle_failure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_shut_down_from_oracle_failure (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    failed_oracle_addr public.address NOT NULL
);


--
-- Name: liquity_events_shut_down_from_oracle_failure_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_shut_down_from_oracle_failure_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_shut_down_from_oracle_failure_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_shut_down_from_oracle_failure_id_seq OWNED BY public.liquity_events_shut_down_from_oracle_failure.id;


--
-- Name: liquity_events_shut_down_from_oracle_failure_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_shut_down_from_oracle_failure_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    failed_oracle_addr public.address NOT NULL
);


--
-- Name: liquity_events_shut_down_from_oracle_failure_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_shut_down_from_oracle_failure_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_shut_down_from_oracle_failure_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_shut_down_from_oracle_failure_testnet_v1_id_seq OWNED BY public.liquity_events_shut_down_from_oracle_failure_testnet_v1.id;


--
-- Name: liquity_events_sorted_troves_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_sorted_troves_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    sorted_troves_address public.address NOT NULL
);


--
-- Name: liquity_events_sorted_troves_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_sorted_troves_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_sorted_troves_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_sorted_troves_address_changed_id_seq OWNED BY public.liquity_events_sorted_troves_address_changed.id;


--
-- Name: liquity_events_sorted_troves_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_sorted_troves_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    sorted_troves_address public.address NOT NULL
);


--
-- Name: liquity_events_sorted_troves_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_sorted_troves_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_sorted_troves_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_sorted_troves_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_sorted_troves_address_changed_testnet_v1.id;


--
-- Name: liquity_events_stability_pool_address_added; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_stability_pool_address_added (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_stability_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_stability_pool_address_added_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_stability_pool_address_added_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_stability_pool_address_added_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_stability_pool_address_added_id_seq OWNED BY public.liquity_events_stability_pool_address_added.id;


--
-- Name: liquity_events_stability_pool_address_added_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_stability_pool_address_added_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_stability_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_stability_pool_address_added_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_stability_pool_address_added_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_stability_pool_address_added_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_stability_pool_address_added_testnet_v1_id_seq OWNED BY public.liquity_events_stability_pool_address_added_testnet_v1.id;


--
-- Name: liquity_events_stability_pool_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_stability_pool_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    stability_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_stability_pool_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_stability_pool_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_stability_pool_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_stability_pool_address_changed_id_seq OWNED BY public.liquity_events_stability_pool_address_changed.id;


--
-- Name: liquity_events_stability_pool_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_stability_pool_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    stability_pool_address public.address NOT NULL
);


--
-- Name: liquity_events_stability_pool_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_stability_pool_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_stability_pool_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_stability_pool_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_stability_pool_address_changed_testnet_v1.id;


--
-- Name: liquity_events_stability_pool_bold_balance_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_stability_pool_bold_balance_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_stability_pool_bold_balance_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_stability_pool_bold_balance_updated_id_seq OWNED BY public.liquity_events_stability_pool_bold_balance_updated.id;


--
-- Name: liquity_events_stability_pool_bold_balance_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_stability_pool_bold_balance_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_balance public.hugeint NOT NULL
);


--
-- Name: liquity_events_stability_pool_bold_balance_updated_testn_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_stability_pool_bold_balance_updated_testn_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_stability_pool_bold_balance_updated_testn_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_stability_pool_bold_balance_updated_testn_id_seq OWNED BY public.liquity_events_stability_pool_bold_balance_updated_testnet_v1.id;


--
-- Name: liquity_events_stability_pool_coll_balance_updated; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_stability_pool_coll_balance_updated (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_balance public.hugeint NOT NULL
);


--
-- Name: liquity_events_stability_pool_coll_balance_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_stability_pool_coll_balance_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_stability_pool_coll_balance_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_stability_pool_coll_balance_updated_id_seq OWNED BY public.liquity_events_stability_pool_coll_balance_updated.id;


--
-- Name: liquity_events_stability_pool_coll_balance_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_stability_pool_coll_balance_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_balance public.hugeint NOT NULL
);


--
-- Name: liquity_events_stability_pool_coll_balance_updated_testn_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_stability_pool_coll_balance_updated_testn_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_stability_pool_coll_balance_updated_testn_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_stability_pool_coll_balance_updated_testn_id_seq OWNED BY public.liquity_events_stability_pool_coll_balance_updated_testnet_v1.id;


--
-- Name: liquity_events_trove_manager_address_added; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_manager_address_added (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_trove_manager_address public.address NOT NULL
);


--
-- Name: liquity_events_trove_manager_address_added_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_manager_address_added_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_manager_address_added_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_manager_address_added_id_seq OWNED BY public.liquity_events_trove_manager_address_added.id;


--
-- Name: liquity_events_trove_manager_address_added_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_manager_address_added_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_trove_manager_address public.address NOT NULL
);


--
-- Name: liquity_events_trove_manager_address_added_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_manager_address_added_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_manager_address_added_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_manager_address_added_testnet_v1_id_seq OWNED BY public.liquity_events_trove_manager_address_added_testnet_v1.id;


--
-- Name: liquity_events_trove_manager_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_manager_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_trove_manager_address public.address NOT NULL
);


--
-- Name: liquity_events_trove_manager_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_manager_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_manager_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_manager_address_changed_id_seq OWNED BY public.liquity_events_trove_manager_address_changed.id;


--
-- Name: liquity_events_trove_manager_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_manager_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_trove_manager_address public.address NOT NULL
);


--
-- Name: liquity_events_trove_manager_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_manager_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_manager_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_manager_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_trove_manager_address_changed_testnet_v1.id;


--
-- Name: liquity_events_trove_nft_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_nft_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_nft_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_nft_address_changed_id_seq OWNED BY public.liquity_events_trove_nft_address_changed.id;


--
-- Name: liquity_events_trove_nft_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_nft_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    new_trove_nft_address public.address NOT NULL
);


--
-- Name: liquity_events_trove_nft_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_nft_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_nft_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_nft_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_trove_nft_address_changed_testnet_v1.id;


--
-- Name: liquity_events_trove_nft_approval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_nft_approval (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    owner public.address NOT NULL,
    approved public.address NOT NULL,
    token_id public.hugeint NOT NULL
);


--
-- Name: liquity_events_trove_nft_approval_for_all; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_nft_approval_for_all (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    owner public.address NOT NULL,
    operator public.address NOT NULL,
    approved boolean NOT NULL
);


--
-- Name: liquity_events_trove_nft_approval_for_all_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_nft_approval_for_all_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_nft_approval_for_all_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_nft_approval_for_all_id_seq OWNED BY public.liquity_events_trove_nft_approval_for_all.id;


--
-- Name: liquity_events_trove_nft_approval_for_all_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_nft_approval_for_all_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    owner public.address NOT NULL,
    operator public.address NOT NULL,
    approved boolean NOT NULL
);


--
-- Name: liquity_events_trove_nft_approval_for_all_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_nft_approval_for_all_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_nft_approval_for_all_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_nft_approval_for_all_testnet_v1_id_seq OWNED BY public.liquity_events_trove_nft_approval_for_all_testnet_v1.id;


--
-- Name: liquity_events_trove_nft_approval_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_nft_approval_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_nft_approval_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_nft_approval_id_seq OWNED BY public.liquity_events_trove_nft_approval.id;


--
-- Name: liquity_events_trove_nft_approval_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_nft_approval_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    owner public.address NOT NULL,
    approved public.address NOT NULL,
    token_id public.hugeint NOT NULL
);


--
-- Name: liquity_events_trove_nft_approval_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_nft_approval_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_nft_approval_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_nft_approval_testnet_v1_id_seq OWNED BY public.liquity_events_trove_nft_approval_testnet_v1.id;


--
-- Name: liquity_events_trove_nft_transfer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_nft_transfer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_nft_transfer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_nft_transfer_id_seq OWNED BY public.liquity_events_trove_nft_transfer.id;


--
-- Name: liquity_events_trove_nft_transfer_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_nft_transfer_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    from_address public.address NOT NULL,
    to_address public.address NOT NULL,
    token_id public.hugeint NOT NULL
);


--
-- Name: liquity_events_trove_nft_transfer_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_nft_transfer_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_nft_transfer_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_nft_transfer_testnet_v1_id_seq OWNED BY public.liquity_events_trove_nft_transfer_testnet_v1.id;


--
-- Name: liquity_events_trove_operation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_operation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_operation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_operation_id_seq OWNED BY public.liquity_events_trove_operation.id;


--
-- Name: liquity_events_trove_operation_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_operation_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    operation integer NOT NULL,
    annual_interest_rate public.hugeint NOT NULL,
    debt_increase_from_redist public.hugeint NOT NULL,
    debt_increase_from_upfront_fee public.hugeint NOT NULL,
    debt_change_from_operation public.hugeint NOT NULL,
    coll_increase_from_redist public.hugeint NOT NULL,
    coll_change_from_operation public.hugeint NOT NULL
);


--
-- Name: liquity_events_trove_operation_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_operation_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_operation_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_operation_testnet_v1_id_seq OWNED BY public.liquity_events_trove_operation_testnet_v1.id;


--
-- Name: liquity_events_trove_updated_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_updated_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_updated_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_updated_id_seq OWNED BY public.liquity_events_trove_updated.id;


--
-- Name: liquity_events_trove_updated_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_trove_updated_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    trove_id public.hugeint NOT NULL,
    debt public.hugeint NOT NULL,
    coll public.hugeint NOT NULL,
    stake public.hugeint NOT NULL,
    annual_interest_rate public.hugeint NOT NULL,
    snapshot_of_total_coll_redist public.hugeint NOT NULL,
    snapshot_of_total_debt_redist public.hugeint NOT NULL
);


--
-- Name: liquity_events_trove_updated_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_trove_updated_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_trove_updated_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_trove_updated_testnet_v1_id_seq OWNED BY public.liquity_events_trove_updated_testnet_v1.id;


--
-- Name: liquity_events_weth_address_changed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_weth_address_changed (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    weth_address public.address NOT NULL
);


--
-- Name: liquity_events_weth_address_changed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_weth_address_changed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_weth_address_changed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_weth_address_changed_id_seq OWNED BY public.liquity_events_weth_address_changed.id;


--
-- Name: liquity_events_weth_address_changed_testnet_v1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquity_events_weth_address_changed_testnet_v1 (
    id integer NOT NULL,
    created_by timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    block_hash public.hash NOT NULL,
    transaction_hash public.hash NOT NULL,
    block_number integer NOT NULL,
    emitter_addr public.address NOT NULL,
    weth_address public.address NOT NULL
);


--
-- Name: liquity_events_weth_address_changed_testnet_v1_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquity_events_weth_address_changed_testnet_v1_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquity_events_weth_address_changed_testnet_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.liquity_events_weth_address_changed_testnet_v1_id_seq OWNED BY public.liquity_events_weth_address_changed_testnet_v1.id;


--
-- Name: accounts_executed_transactions_1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_executed_transactions_1 ALTER COLUMN id SET DEFAULT nextval('public.accounts_executed_transactions_1_id_seq'::regclass);


--
-- Name: accounts_executed_transactions_2 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_executed_transactions_2 ALTER COLUMN id SET DEFAULT nextval('public.accounts_executed_transactions_2_id_seq'::regclass);


--
-- Name: accounts_secrets_1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_secrets_1 ALTER COLUMN id SET DEFAULT nextval('public.accounts_secrets_1_id_seq'::regclass);


--
-- Name: accounts_secrets_2 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_secrets_2 ALTER COLUMN id SET DEFAULT nextval('public.accounts_secrets_2_id_seq'::regclass);


--
-- Name: accounts_secrets_nonces_1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_secrets_nonces_1 ALTER COLUMN id SET DEFAULT nextval('public.accounts_secrets_nonces_1_id_seq'::regclass);


--
-- Name: accounts_secrets_nonces_2 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_secrets_nonces_2 ALTER COLUMN id SET DEFAULT nextval('public.accounts_secrets_nonces_2_id_seq'::regclass);


--
-- Name: accounts_sender_keys_1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_sender_keys_1 ALTER COLUMN id SET DEFAULT nextval('public.accounts_sender_keys_1_id_seq'::regclass);


--
-- Name: florin_faucet_amounts_sent_1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_faucet_amounts_sent_1 ALTER COLUMN id SET DEFAULT nextval('public.florin_faucet_amounts_sent_1_id_seq'::regclass);


--
-- Name: florin_ingestor_checkpointing_1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_ingestor_checkpointing_1 ALTER COLUMN id SET DEFAULT nextval('public.florin_ingestor_checkpointing_1_id_seq'::regclass);


--
-- Name: florin_ingestor_checkpointing_1_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_ingestor_checkpointing_1_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.florin_ingestor_checkpointing_1_testnet_v1_id_seq'::regclass);


--
-- Name: florin_stability_pool_apr_history_1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_stability_pool_apr_history_1 ALTER COLUMN id SET DEFAULT nextval('public.florin_stability_pool_apr_history_1_id_seq'::regclass);


--
-- Name: liquity_events_active_pool_address_added id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_address_added ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_active_pool_address_added_id_seq'::regclass);


--
-- Name: liquity_events_active_pool_address_added_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_address_added_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_active_pool_address_added_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_active_pool_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_active_pool_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_active_pool_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_active_pool_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_active_pool_bold_debt_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_bold_debt_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_active_pool_bold_debt_updated_id_seq'::regclass);


--
-- Name: liquity_events_active_pool_bold_debt_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_bold_debt_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_active_pool_bold_debt_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_active_pool_coll_balance_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_coll_balance_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_active_pool_coll_balance_updated_id_seq'::regclass);


--
-- Name: liquity_events_active_pool_coll_balance_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_coll_balance_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_active_pool_coll_balance_updated_testnet__id_seq'::regclass);


--
-- Name: liquity_events_add_manager_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_add_manager_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_add_manager_updated_id_seq'::regclass);


--
-- Name: liquity_events_add_manager_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_add_manager_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_add_manager_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_b_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_b_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_b_updated_id_seq'::regclass);


--
-- Name: liquity_events_b_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_b_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_b_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_base_rate_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_base_rate_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_base_rate_updated_id_seq'::regclass);


--
-- Name: liquity_events_base_rate_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_base_rate_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_base_rate_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_batch_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_batch_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_batch_updated_id_seq'::regclass);


--
-- Name: liquity_events_batch_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_batch_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_batch_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_batched_trove_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_batched_trove_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_batched_trove_updated_id_seq'::regclass);


--
-- Name: liquity_events_batched_trove_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_batched_trove_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_batched_trove_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_bold_token_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_bold_token_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_bold_token_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_bold_token_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_bold_token_approval id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_approval ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_bold_token_approval_id_seq'::regclass);


--
-- Name: liquity_events_bold_token_approval_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_approval_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_bold_token_approval_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_bold_token_transfer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_transfer ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_bold_token_transfer_id_seq'::regclass);


--
-- Name: liquity_events_bold_token_transfer_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_transfer_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_bold_token_transfer_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_borrower_operations_address_added id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_borrower_operations_address_added ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_borrower_operations_address_added_id_seq'::regclass);


--
-- Name: liquity_events_borrower_operations_address_added_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_borrower_operations_address_added_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_borrower_operations_address_added_testnet_id_seq'::regclass);


--
-- Name: liquity_events_borrower_operations_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_borrower_operations_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_borrower_operations_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_borrower_operations_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_borrower_operations_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_borrower_operations_address_changed_testn_id_seq'::regclass);


--
-- Name: liquity_events_coll_balance_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_balance_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_coll_balance_updated_id_seq'::regclass);


--
-- Name: liquity_events_coll_balance_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_balance_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_coll_balance_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_coll_sent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_sent ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_coll_sent_id_seq'::regclass);


--
-- Name: liquity_events_coll_sent_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_sent_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_coll_sent_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_coll_surplus_pool_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_surplus_pool_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_coll_surplus_pool_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_coll_surplus_pool_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_surplus_pool_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_coll_surplus_pool_address_changed_testnet_id_seq'::regclass);


--
-- Name: liquity_events_coll_token_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_token_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_coll_token_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_coll_token_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_token_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_coll_token_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_collateral_registry_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_collateral_registry_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_collateral_registry_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_collateral_registry_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_collateral_registry_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_collateral_registry_address_changed_testn_id_seq'::regclass);


--
-- Name: liquity_events_default_pool_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_default_pool_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_default_pool_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_default_pool_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_default_pool_bold_debt_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_bold_debt_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_default_pool_bold_debt_updated_id_seq'::regclass);


--
-- Name: liquity_events_default_pool_bold_debt_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_bold_debt_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_default_pool_bold_debt_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_default_pool_coll_balance_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_coll_balance_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_default_pool_coll_balance_updated_id_seq'::regclass);


--
-- Name: liquity_events_default_pool_coll_balance_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_coll_balance_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_default_pool_coll_balance_updated_testnet_id_seq'::regclass);


--
-- Name: liquity_events_deposit_operation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_deposit_operation ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_deposit_operation_id_seq'::regclass);


--
-- Name: liquity_events_deposit_operation_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_deposit_operation_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_deposit_operation_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_deposit_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_deposit_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_deposit_updated_id_seq'::regclass);


--
-- Name: liquity_events_deposit_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_deposit_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_deposit_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_gas_pool_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_gas_pool_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_gas_pool_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_gas_pool_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_gas_pool_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_gas_pool_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_hint_helpers_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_hint_helpers_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_hint_helpers_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_hint_helpers_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_hint_helpers_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_hint_helpers_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_interest_router_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_interest_router_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_interest_router_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_interest_router_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_interest_router_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_interest_router_address_changed_testnet_v_id_seq'::regclass);


--
-- Name: liquity_events_last_fee_op_time_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_last_fee_op_time_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_last_fee_op_time_updated_id_seq'::regclass);


--
-- Name: liquity_events_last_fee_op_time_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_last_fee_op_time_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_last_fee_op_time_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_last_good_price_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_last_good_price_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_last_good_price_updated_id_seq'::regclass);


--
-- Name: liquity_events_last_good_price_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_last_good_price_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_last_good_price_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_liquidation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_liquidation ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_liquidation_id_seq'::regclass);


--
-- Name: liquity_events_liquidation_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_liquidation_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_liquidation_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_metadata_nft_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_metadata_nft_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_metadata_nft_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_metadata_nft_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_metadata_nft_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_metadata_nft_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_multi_trove_getter_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_multi_trove_getter_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_multi_trove_getter_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_multi_trove_getter_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_multi_trove_getter_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_multi_trove_getter_address_changed_testne_id_seq'::regclass);


--
-- Name: liquity_events_ownership_transferred id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_ownership_transferred ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_ownership_transferred_id_seq'::regclass);


--
-- Name: liquity_events_ownership_transferred_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_ownership_transferred_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_ownership_transferred_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_p_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_p_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_p_updated_id_seq'::regclass);


--
-- Name: liquity_events_p_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_p_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_p_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_price_feed_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_price_feed_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_price_feed_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_price_feed_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_price_feed_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_price_feed_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_redemption id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_redemption ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_redemption_id_seq'::regclass);


--
-- Name: liquity_events_redemption_fee_paid_to_trove id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_redemption_fee_paid_to_trove ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_redemption_fee_paid_to_trove_id_seq'::regclass);


--
-- Name: liquity_events_redemption_fee_paid_to_trove_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_redemption_fee_paid_to_trove_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_redemption_fee_paid_to_trove_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_redemption_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_redemption_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_redemption_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_remove_manager_and_receiver_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_remove_manager_and_receiver_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_remove_manager_and_receiver_updated_id_seq'::regclass);


--
-- Name: liquity_events_remove_manager_and_receiver_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_remove_manager_and_receiver_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_remove_manager_and_receiver_updated_testn_id_seq'::regclass);


--
-- Name: liquity_events_s_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_s_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_s_updated_id_seq'::regclass);


--
-- Name: liquity_events_s_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_s_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_s_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_scale_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_scale_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_scale_updated_id_seq'::regclass);


--
-- Name: liquity_events_scale_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_scale_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_scale_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_shut_down_from_oracle_failure id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_shut_down_from_oracle_failure ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_shut_down_from_oracle_failure_id_seq'::regclass);


--
-- Name: liquity_events_shut_down_from_oracle_failure_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_shut_down_from_oracle_failure_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_shut_down_from_oracle_failure_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_sorted_troves_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_sorted_troves_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_sorted_troves_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_sorted_troves_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_sorted_troves_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_sorted_troves_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_stability_pool_address_added id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_address_added ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_stability_pool_address_added_id_seq'::regclass);


--
-- Name: liquity_events_stability_pool_address_added_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_address_added_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_stability_pool_address_added_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_stability_pool_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_stability_pool_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_stability_pool_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_stability_pool_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_stability_pool_bold_balance_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_bold_balance_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_stability_pool_bold_balance_updated_id_seq'::regclass);


--
-- Name: liquity_events_stability_pool_bold_balance_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_bold_balance_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_stability_pool_bold_balance_updated_testn_id_seq'::regclass);


--
-- Name: liquity_events_stability_pool_coll_balance_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_coll_balance_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_stability_pool_coll_balance_updated_id_seq'::regclass);


--
-- Name: liquity_events_stability_pool_coll_balance_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_coll_balance_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_stability_pool_coll_balance_updated_testn_id_seq'::regclass);


--
-- Name: liquity_events_trove_manager_address_added id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_manager_address_added ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_manager_address_added_id_seq'::regclass);


--
-- Name: liquity_events_trove_manager_address_added_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_manager_address_added_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_manager_address_added_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_trove_manager_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_manager_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_manager_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_trove_manager_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_manager_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_manager_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_trove_nft_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_nft_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_trove_nft_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_nft_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_trove_nft_approval id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_approval ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_nft_approval_id_seq'::regclass);


--
-- Name: liquity_events_trove_nft_approval_for_all id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_approval_for_all ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_nft_approval_for_all_id_seq'::regclass);


--
-- Name: liquity_events_trove_nft_approval_for_all_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_approval_for_all_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_nft_approval_for_all_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_trove_nft_approval_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_approval_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_nft_approval_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_trove_nft_transfer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_transfer ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_nft_transfer_id_seq'::regclass);


--
-- Name: liquity_events_trove_nft_transfer_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_transfer_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_nft_transfer_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_trove_operation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_operation ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_operation_id_seq'::regclass);


--
-- Name: liquity_events_trove_operation_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_operation_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_operation_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_trove_updated id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_updated ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_updated_id_seq'::regclass);


--
-- Name: liquity_events_trove_updated_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_updated_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_trove_updated_testnet_v1_id_seq'::regclass);


--
-- Name: liquity_events_weth_address_changed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_weth_address_changed ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_weth_address_changed_id_seq'::regclass);


--
-- Name: liquity_events_weth_address_changed_testnet_v1 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_weth_address_changed_testnet_v1 ALTER COLUMN id SET DEFAULT nextval('public.liquity_events_weth_address_changed_testnet_v1_id_seq'::regclass);


--
-- Name: accounts_executed_transactions_1 accounts_executed_transactions_1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_executed_transactions_1
    ADD CONSTRAINT accounts_executed_transactions_1_pkey PRIMARY KEY (id);


--
-- Name: accounts_executed_transactions_1 accounts_executed_transactions_1_transaction_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_executed_transactions_1
    ADD CONSTRAINT accounts_executed_transactions_1_transaction_hash_key UNIQUE (transaction_hash);


--
-- Name: accounts_executed_transactions_2 accounts_executed_transactions_2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_executed_transactions_2
    ADD CONSTRAINT accounts_executed_transactions_2_pkey PRIMARY KEY (id);


--
-- Name: accounts_migrations accounts_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_migrations
    ADD CONSTRAINT accounts_migrations_pkey PRIMARY KEY (version);


--
-- Name: accounts_secrets_1 accounts_secrets_1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_secrets_1
    ADD CONSTRAINT accounts_secrets_1_pkey PRIMARY KEY (id);


--
-- Name: accounts_secrets_2 accounts_secrets_2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_secrets_2
    ADD CONSTRAINT accounts_secrets_2_pkey PRIMARY KEY (id);


--
-- Name: accounts_secrets_nonces_1 accounts_secrets_nonces_1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_secrets_nonces_1
    ADD CONSTRAINT accounts_secrets_nonces_1_pkey PRIMARY KEY (id);


--
-- Name: accounts_secrets_nonces_2 accounts_secrets_nonces_2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_secrets_nonces_2
    ADD CONSTRAINT accounts_secrets_nonces_2_pkey PRIMARY KEY (id);


--
-- Name: accounts_sender_keys_1 accounts_sender_keys_1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_sender_keys_1
    ADD CONSTRAINT accounts_sender_keys_1_pkey PRIMARY KEY (id);


--
-- Name: accounts_sender_keys_1 accounts_sender_keys_1_private_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_sender_keys_1
    ADD CONSTRAINT accounts_sender_keys_1_private_key_key UNIQUE (private_key);


--
-- Name: florin_chain_blocks_1 florin_chain_blocks_1_block_number_block_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_chain_blocks_1
    ADD CONSTRAINT florin_chain_blocks_1_block_number_block_hash_key UNIQUE (block_number, block_hash);


--
-- Name: florin_chain_blocks_1 florin_chain_blocks_1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_chain_blocks_1
    ADD CONSTRAINT florin_chain_blocks_1_pkey PRIMARY KEY (block_number);


--
-- Name: florin_faucet_amounts_sent_1 florin_faucet_amounts_sent_1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_faucet_amounts_sent_1
    ADD CONSTRAINT florin_faucet_amounts_sent_1_pkey PRIMARY KEY (id);


--
-- Name: florin_faucet_migrationst florin_faucet_migrationst_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_faucet_migrationst
    ADD CONSTRAINT florin_faucet_migrationst_pkey PRIMARY KEY (version);


--
-- Name: florin_ingestor_checkpointing_1 florin_ingestor_checkpointing_1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_ingestor_checkpointing_1
    ADD CONSTRAINT florin_ingestor_checkpointing_1_pkey PRIMARY KEY (id);


--
-- Name: florin_ingestor_checkpointing_1_testnet_v1 florin_ingestor_checkpointing_1_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_ingestor_checkpointing_1_testnet_v1
    ADD CONSTRAINT florin_ingestor_checkpointing_1_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: florin_migrations florin_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_migrations
    ADD CONSTRAINT florin_migrations_pkey PRIMARY KEY (version);


--
-- Name: florin_stability_pool_accounting_1 florin_stability_pool_accounting_1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_stability_pool_accounting_1
    ADD CONSTRAINT florin_stability_pool_accounting_1_pkey PRIMARY KEY (stability_pool, block_number);


--
-- Name: florin_stability_pool_apr_history_1 florin_stability_pool_apr_history_1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_stability_pool_apr_history_1
    ADD CONSTRAINT florin_stability_pool_apr_history_1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_active_pool_address_added liquity_events_active_pool_address_added_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_address_added
    ADD CONSTRAINT liquity_events_active_pool_address_added_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_active_pool_address_added_testnet_v1 liquity_events_active_pool_address_added_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_address_added_testnet_v1
    ADD CONSTRAINT liquity_events_active_pool_address_added_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_active_pool_address_changed liquity_events_active_pool_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_address_changed
    ADD CONSTRAINT liquity_events_active_pool_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_active_pool_address_changed_testnet_v1 liquity_events_active_pool_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_active_pool_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_active_pool_bold_debt_updated liquity_events_active_pool_bold_debt_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_bold_debt_updated
    ADD CONSTRAINT liquity_events_active_pool_bold_debt_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_active_pool_bold_debt_updated_testnet_v1 liquity_events_active_pool_bold_debt_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_bold_debt_updated_testnet_v1
    ADD CONSTRAINT liquity_events_active_pool_bold_debt_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_active_pool_coll_balance_updated liquity_events_active_pool_coll_balance_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_coll_balance_updated
    ADD CONSTRAINT liquity_events_active_pool_coll_balance_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_active_pool_coll_balance_updated_testnet_v1 liquity_events_active_pool_coll_balance_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_active_pool_coll_balance_updated_testnet_v1
    ADD CONSTRAINT liquity_events_active_pool_coll_balance_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_add_manager_updated liquity_events_add_manager_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_add_manager_updated
    ADD CONSTRAINT liquity_events_add_manager_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_add_manager_updated_testnet_v1 liquity_events_add_manager_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_add_manager_updated_testnet_v1
    ADD CONSTRAINT liquity_events_add_manager_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_b_updated liquity_events_b_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_b_updated
    ADD CONSTRAINT liquity_events_b_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_b_updated_testnet_v1 liquity_events_b_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_b_updated_testnet_v1
    ADD CONSTRAINT liquity_events_b_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_base_rate_updated liquity_events_base_rate_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_base_rate_updated
    ADD CONSTRAINT liquity_events_base_rate_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_base_rate_updated_testnet_v1 liquity_events_base_rate_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_base_rate_updated_testnet_v1
    ADD CONSTRAINT liquity_events_base_rate_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_batch_updated liquity_events_batch_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_batch_updated
    ADD CONSTRAINT liquity_events_batch_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_batch_updated_testnet_v1 liquity_events_batch_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_batch_updated_testnet_v1
    ADD CONSTRAINT liquity_events_batch_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_batched_trove_updated liquity_events_batched_trove_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_batched_trove_updated
    ADD CONSTRAINT liquity_events_batched_trove_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_batched_trove_updated_testnet_v1 liquity_events_batched_trove_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_batched_trove_updated_testnet_v1
    ADD CONSTRAINT liquity_events_batched_trove_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_bold_token_address_changed liquity_events_bold_token_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_address_changed
    ADD CONSTRAINT liquity_events_bold_token_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_bold_token_address_changed_testnet_v1 liquity_events_bold_token_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_bold_token_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_bold_token_approval liquity_events_bold_token_approval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_approval
    ADD CONSTRAINT liquity_events_bold_token_approval_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_bold_token_approval_testnet_v1 liquity_events_bold_token_approval_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_approval_testnet_v1
    ADD CONSTRAINT liquity_events_bold_token_approval_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_bold_token_transfer liquity_events_bold_token_transfer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_transfer
    ADD CONSTRAINT liquity_events_bold_token_transfer_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_bold_token_transfer_testnet_v1 liquity_events_bold_token_transfer_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_bold_token_transfer_testnet_v1
    ADD CONSTRAINT liquity_events_bold_token_transfer_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_borrower_operations_address_added liquity_events_borrower_operations_address_added_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_borrower_operations_address_added
    ADD CONSTRAINT liquity_events_borrower_operations_address_added_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_borrower_operations_address_added_testnet_v1 liquity_events_borrower_operations_address_added_testnet_v_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_borrower_operations_address_added_testnet_v1
    ADD CONSTRAINT liquity_events_borrower_operations_address_added_testnet_v_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_borrower_operations_address_changed liquity_events_borrower_operations_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_borrower_operations_address_changed
    ADD CONSTRAINT liquity_events_borrower_operations_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_borrower_operations_address_changed_testnet_v1 liquity_events_borrower_operations_address_changed_testnet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_borrower_operations_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_borrower_operations_address_changed_testnet_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_coll_balance_updated liquity_events_coll_balance_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_balance_updated
    ADD CONSTRAINT liquity_events_coll_balance_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_coll_balance_updated_testnet_v1 liquity_events_coll_balance_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_balance_updated_testnet_v1
    ADD CONSTRAINT liquity_events_coll_balance_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_coll_sent liquity_events_coll_sent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_sent
    ADD CONSTRAINT liquity_events_coll_sent_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_coll_sent_testnet_v1 liquity_events_coll_sent_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_sent_testnet_v1
    ADD CONSTRAINT liquity_events_coll_sent_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_coll_surplus_pool_address_changed liquity_events_coll_surplus_pool_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_surplus_pool_address_changed
    ADD CONSTRAINT liquity_events_coll_surplus_pool_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_coll_surplus_pool_address_changed_testnet_v1 liquity_events_coll_surplus_pool_address_changed_testnet_v_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_surplus_pool_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_coll_surplus_pool_address_changed_testnet_v_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_coll_token_address_changed liquity_events_coll_token_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_token_address_changed
    ADD CONSTRAINT liquity_events_coll_token_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_coll_token_address_changed_testnet_v1 liquity_events_coll_token_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_coll_token_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_coll_token_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_collateral_registry_address_changed liquity_events_collateral_registry_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_collateral_registry_address_changed
    ADD CONSTRAINT liquity_events_collateral_registry_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_collateral_registry_address_changed_testnet_v1 liquity_events_collateral_registry_address_changed_testnet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_collateral_registry_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_collateral_registry_address_changed_testnet_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_default_pool_address_changed liquity_events_default_pool_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_address_changed
    ADD CONSTRAINT liquity_events_default_pool_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_default_pool_address_changed_testnet_v1 liquity_events_default_pool_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_default_pool_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_default_pool_bold_debt_updated liquity_events_default_pool_bold_debt_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_bold_debt_updated
    ADD CONSTRAINT liquity_events_default_pool_bold_debt_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_default_pool_bold_debt_updated_testnet_v1 liquity_events_default_pool_bold_debt_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_bold_debt_updated_testnet_v1
    ADD CONSTRAINT liquity_events_default_pool_bold_debt_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_default_pool_coll_balance_updated liquity_events_default_pool_coll_balance_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_coll_balance_updated
    ADD CONSTRAINT liquity_events_default_pool_coll_balance_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_default_pool_coll_balance_updated_testnet_v1 liquity_events_default_pool_coll_balance_updated_testnet_v_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_default_pool_coll_balance_updated_testnet_v1
    ADD CONSTRAINT liquity_events_default_pool_coll_balance_updated_testnet_v_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_deposit_operation liquity_events_deposit_operation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_deposit_operation
    ADD CONSTRAINT liquity_events_deposit_operation_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_deposit_operation_testnet_v1 liquity_events_deposit_operation_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_deposit_operation_testnet_v1
    ADD CONSTRAINT liquity_events_deposit_operation_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_deposit_updated liquity_events_deposit_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_deposit_updated
    ADD CONSTRAINT liquity_events_deposit_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_deposit_updated_testnet_v1 liquity_events_deposit_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_deposit_updated_testnet_v1
    ADD CONSTRAINT liquity_events_deposit_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_gas_pool_address_changed liquity_events_gas_pool_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_gas_pool_address_changed
    ADD CONSTRAINT liquity_events_gas_pool_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_gas_pool_address_changed_testnet_v1 liquity_events_gas_pool_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_gas_pool_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_gas_pool_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_hint_helpers_address_changed liquity_events_hint_helpers_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_hint_helpers_address_changed
    ADD CONSTRAINT liquity_events_hint_helpers_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_hint_helpers_address_changed_testnet_v1 liquity_events_hint_helpers_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_hint_helpers_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_hint_helpers_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_interest_router_address_changed liquity_events_interest_router_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_interest_router_address_changed
    ADD CONSTRAINT liquity_events_interest_router_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_interest_router_address_changed_testnet_v1 liquity_events_interest_router_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_interest_router_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_interest_router_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_last_fee_op_time_updated liquity_events_last_fee_op_time_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_last_fee_op_time_updated
    ADD CONSTRAINT liquity_events_last_fee_op_time_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_last_fee_op_time_updated_testnet_v1 liquity_events_last_fee_op_time_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_last_fee_op_time_updated_testnet_v1
    ADD CONSTRAINT liquity_events_last_fee_op_time_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_last_good_price_updated liquity_events_last_good_price_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_last_good_price_updated
    ADD CONSTRAINT liquity_events_last_good_price_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_last_good_price_updated_testnet_v1 liquity_events_last_good_price_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_last_good_price_updated_testnet_v1
    ADD CONSTRAINT liquity_events_last_good_price_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_liquidation liquity_events_liquidation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_liquidation
    ADD CONSTRAINT liquity_events_liquidation_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_liquidation_testnet_v1 liquity_events_liquidation_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_liquidation_testnet_v1
    ADD CONSTRAINT liquity_events_liquidation_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_metadata_nft_address_changed liquity_events_metadata_nft_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_metadata_nft_address_changed
    ADD CONSTRAINT liquity_events_metadata_nft_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_metadata_nft_address_changed_testnet_v1 liquity_events_metadata_nft_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_metadata_nft_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_metadata_nft_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_multi_trove_getter_address_changed liquity_events_multi_trove_getter_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_multi_trove_getter_address_changed
    ADD CONSTRAINT liquity_events_multi_trove_getter_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_multi_trove_getter_address_changed_testnet_v1 liquity_events_multi_trove_getter_address_changed_testnet__pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_multi_trove_getter_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_multi_trove_getter_address_changed_testnet__pkey PRIMARY KEY (id);


--
-- Name: liquity_events_ownership_transferred liquity_events_ownership_transferred_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_ownership_transferred
    ADD CONSTRAINT liquity_events_ownership_transferred_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_ownership_transferred_testnet_v1 liquity_events_ownership_transferred_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_ownership_transferred_testnet_v1
    ADD CONSTRAINT liquity_events_ownership_transferred_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_p_updated liquity_events_p_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_p_updated
    ADD CONSTRAINT liquity_events_p_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_p_updated_testnet_v1 liquity_events_p_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_p_updated_testnet_v1
    ADD CONSTRAINT liquity_events_p_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_price_feed_address_changed liquity_events_price_feed_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_price_feed_address_changed
    ADD CONSTRAINT liquity_events_price_feed_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_price_feed_address_changed_testnet_v1 liquity_events_price_feed_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_price_feed_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_price_feed_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_redemption_fee_paid_to_trove liquity_events_redemption_fee_paid_to_trove_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_redemption_fee_paid_to_trove
    ADD CONSTRAINT liquity_events_redemption_fee_paid_to_trove_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_redemption_fee_paid_to_trove_testnet_v1 liquity_events_redemption_fee_paid_to_trove_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_redemption_fee_paid_to_trove_testnet_v1
    ADD CONSTRAINT liquity_events_redemption_fee_paid_to_trove_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_redemption liquity_events_redemption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_redemption
    ADD CONSTRAINT liquity_events_redemption_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_redemption_testnet_v1 liquity_events_redemption_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_redemption_testnet_v1
    ADD CONSTRAINT liquity_events_redemption_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_remove_manager_and_receiver_updated liquity_events_remove_manager_and_receiver_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_remove_manager_and_receiver_updated
    ADD CONSTRAINT liquity_events_remove_manager_and_receiver_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_remove_manager_and_receiver_updated_testnet_v1 liquity_events_remove_manager_and_receiver_updated_testnet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_remove_manager_and_receiver_updated_testnet_v1
    ADD CONSTRAINT liquity_events_remove_manager_and_receiver_updated_testnet_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_s_updated liquity_events_s_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_s_updated
    ADD CONSTRAINT liquity_events_s_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_s_updated_testnet_v1 liquity_events_s_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_s_updated_testnet_v1
    ADD CONSTRAINT liquity_events_s_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_scale_updated liquity_events_scale_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_scale_updated
    ADD CONSTRAINT liquity_events_scale_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_scale_updated_testnet_v1 liquity_events_scale_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_scale_updated_testnet_v1
    ADD CONSTRAINT liquity_events_scale_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_shut_down_from_oracle_failure liquity_events_shut_down_from_oracle_failure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_shut_down_from_oracle_failure
    ADD CONSTRAINT liquity_events_shut_down_from_oracle_failure_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_shut_down_from_oracle_failure_testnet_v1 liquity_events_shut_down_from_oracle_failure_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_shut_down_from_oracle_failure_testnet_v1
    ADD CONSTRAINT liquity_events_shut_down_from_oracle_failure_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_sorted_troves_address_changed liquity_events_sorted_troves_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_sorted_troves_address_changed
    ADD CONSTRAINT liquity_events_sorted_troves_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_sorted_troves_address_changed_testnet_v1 liquity_events_sorted_troves_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_sorted_troves_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_sorted_troves_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_stability_pool_address_added liquity_events_stability_pool_address_added_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_address_added
    ADD CONSTRAINT liquity_events_stability_pool_address_added_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_stability_pool_address_added_testnet_v1 liquity_events_stability_pool_address_added_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_address_added_testnet_v1
    ADD CONSTRAINT liquity_events_stability_pool_address_added_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_stability_pool_address_changed liquity_events_stability_pool_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_address_changed
    ADD CONSTRAINT liquity_events_stability_pool_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_stability_pool_address_changed_testnet_v1 liquity_events_stability_pool_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_stability_pool_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_stability_pool_bold_balance_updated liquity_events_stability_pool_bold_balance_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_bold_balance_updated
    ADD CONSTRAINT liquity_events_stability_pool_bold_balance_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_stability_pool_bold_balance_updated_testnet_v1 liquity_events_stability_pool_bold_balance_updated_testnet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_bold_balance_updated_testnet_v1
    ADD CONSTRAINT liquity_events_stability_pool_bold_balance_updated_testnet_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_stability_pool_coll_balance_updated liquity_events_stability_pool_coll_balance_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_coll_balance_updated
    ADD CONSTRAINT liquity_events_stability_pool_coll_balance_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_stability_pool_coll_balance_updated_testnet_v1 liquity_events_stability_pool_coll_balance_updated_testnet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_stability_pool_coll_balance_updated_testnet_v1
    ADD CONSTRAINT liquity_events_stability_pool_coll_balance_updated_testnet_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_manager_address_added liquity_events_trove_manager_address_added_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_manager_address_added
    ADD CONSTRAINT liquity_events_trove_manager_address_added_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_manager_address_added_testnet_v1 liquity_events_trove_manager_address_added_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_manager_address_added_testnet_v1
    ADD CONSTRAINT liquity_events_trove_manager_address_added_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_manager_address_changed liquity_events_trove_manager_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_manager_address_changed
    ADD CONSTRAINT liquity_events_trove_manager_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_manager_address_changed_testnet_v1 liquity_events_trove_manager_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_manager_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_trove_manager_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_nft_address_changed liquity_events_trove_nft_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_address_changed
    ADD CONSTRAINT liquity_events_trove_nft_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_nft_address_changed_testnet_v1 liquity_events_trove_nft_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_trove_nft_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_nft_approval_for_all liquity_events_trove_nft_approval_for_all_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_approval_for_all
    ADD CONSTRAINT liquity_events_trove_nft_approval_for_all_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_nft_approval_for_all_testnet_v1 liquity_events_trove_nft_approval_for_all_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_approval_for_all_testnet_v1
    ADD CONSTRAINT liquity_events_trove_nft_approval_for_all_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_nft_approval liquity_events_trove_nft_approval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_approval
    ADD CONSTRAINT liquity_events_trove_nft_approval_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_nft_approval_testnet_v1 liquity_events_trove_nft_approval_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_approval_testnet_v1
    ADD CONSTRAINT liquity_events_trove_nft_approval_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_nft_transfer liquity_events_trove_nft_transfer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_transfer
    ADD CONSTRAINT liquity_events_trove_nft_transfer_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_nft_transfer_testnet_v1 liquity_events_trove_nft_transfer_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_nft_transfer_testnet_v1
    ADD CONSTRAINT liquity_events_trove_nft_transfer_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_operation liquity_events_trove_operation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_operation
    ADD CONSTRAINT liquity_events_trove_operation_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_operation_testnet_v1 liquity_events_trove_operation_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_operation_testnet_v1
    ADD CONSTRAINT liquity_events_trove_operation_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_updated liquity_events_trove_updated_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_updated
    ADD CONSTRAINT liquity_events_trove_updated_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_trove_updated_testnet_v1 liquity_events_trove_updated_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_trove_updated_testnet_v1
    ADD CONSTRAINT liquity_events_trove_updated_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_weth_address_changed liquity_events_weth_address_changed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_weth_address_changed
    ADD CONSTRAINT liquity_events_weth_address_changed_pkey PRIMARY KEY (id);


--
-- Name: liquity_events_weth_address_changed_testnet_v1 liquity_events_weth_address_changed_testnet_v1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquity_events_weth_address_changed_testnet_v1
    ADD CONSTRAINT liquity_events_weth_address_changed_testnet_v1_pkey PRIMARY KEY (id);


--
-- Name: accounts_executed_transactions_2_desc__idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_executed_transactions_2_desc__idx ON public.accounts_executed_transactions_2 USING btree (desc_);


--
-- Name: accounts_executed_transactions_2_eoa_addr_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_executed_transactions_2_eoa_addr_idx ON public.accounts_executed_transactions_2 USING btree (eoa_addr);


--
-- Name: accounts_executed_transactions_2_transaction_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_executed_transactions_2_transaction_hash_idx ON public.accounts_executed_transactions_2 USING btree (transaction_hash);


--
-- Name: accounts_secrets_nonces_1_secret_id_consumed_nonce_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX accounts_secrets_nonces_1_secret_id_consumed_nonce_idx ON public.accounts_secrets_nonces_1 USING btree (secret_id, consumed_nonce);


--
-- Name: accounts_secrets_nonces_2_eoa_addr_nonce_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX accounts_secrets_nonces_2_eoa_addr_nonce_idx ON public.accounts_secrets_nonces_2 USING btree (eoa_addr, nonce);


--
-- Name: florin_faucet_amounts_sent_1_recipient_2hour; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX florin_faucet_amounts_sent_1_recipient_2hour ON public.florin_faucet_amounts_sent_1 USING btree (recipient, ((date_trunc('day'::text, created_by) + ('02:00:00'::interval * (floor((EXTRACT(hour FROM created_by) / (2)::numeric)))::double precision))));


--
-- Name: florin_stability_pool_apr_history_1_latest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX florin_stability_pool_apr_history_1_latest_idx ON public.florin_stability_pool_apr_history_1 USING btree (stability_pool, id DESC);


--
-- Name: liquity_events_b_updated_pool_block_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX liquity_events_b_updated_pool_block_id_idx ON public.liquity_events_b_updated USING btree (emitter_addr, block_number, id);


--
-- Name: liquity_events_p_updated_pool_block_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX liquity_events_p_updated_pool_block_id_idx ON public.liquity_events_p_updated USING btree (emitter_addr, block_number, id);


--
-- Name: florin_stability_pool_accounting_1 florin_stability_pool_accounting_1_block_number_block_hash_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.florin_stability_pool_accounting_1
    ADD CONSTRAINT florin_stability_pool_accounting_1_block_number_block_hash_fkey FOREIGN KEY (block_number, block_hash) REFERENCES public.florin_chain_blocks_1(block_number, block_hash) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict u82MA4UfaMyVnL84zaKAOce3YMpnSV4GZt7WPCV6UBytk51q8zL4Ntat01bogWz


--
-- Dbmate schema migrations
--

INSERT INTO public.florin_migrations (version) VALUES
    ('1789985083'),
    ('1789985084'),
    ('1790683508'),
    ('1794481872'),
    ('1794483397');
