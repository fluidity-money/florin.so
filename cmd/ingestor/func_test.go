package main

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	ethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/require"

	"github.com/fluidity-money/florin.so/lib/events/liquity"
)

func TestHandleLogCallback(t *testing.T) {
	emitter := common.HexToAddress("0x1111111111111111111111111111111111111111")
	blockHash := common.HexToHash("0x1234")
	txHash := common.HexToHash("0x5678")
	data := common.LeftPadBytes(big.NewInt(25).Bytes(), 32)
	log := ethTypes.Log{
		Address:     emitter,
		Topics:      []common.Hash{liquity.TopicBaseRateUpdated},
		Data:        data,
		BlockHash:   blockHash,
		TxHash:      txHash,
		BlockNumber: 99,
	}

	var table string
	var inserted any
	changed, err := handleLogCallback(
		IngestorArgs{LiquityEmitters: []common.Address{emitter}},
		log,
		func(t string, event any) error {
			table, inserted = t, event
			return nil
		},
	)
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, "liquity_events_base_rate_updated", table)
	event, ok := inserted.(*liquity.BaseRateUpdated)
	require.True(t, ok)
	require.Equal(t, "25", event.BaseRate.String())
	require.Equal(t, blockHash.String(), event.BlockHash)
	require.Equal(t, txHash.String(), event.TransactionHash)
	require.Equal(t, uint64(99), event.BlockNumber)
	require.Equal(t, emitter.String(), event.EmitterAddr)
}

func TestHandleLogCallbackRejectsUnknownEmitter(t *testing.T) {
	called := false
	changed, err := handleLogCallback(
		IngestorArgs{LiquityEmitters: []common.Address{common.HexToAddress("0x1111111111111111111111111111111111111111")}},
		ethTypes.Log{
			Address: common.HexToAddress("0x2222222222222222222222222222222222222222"),
			Topics:  []common.Hash{liquity.TopicBaseRateUpdated},
		},
		func(string, any) error { called = true; return nil },
	)
	require.NoError(t, err)
	require.False(t, changed)
	require.False(t, called)
}

func TestBoundedBlockRange(t *testing.T) {
	to, checkpoint, ok := boundedBlockRange(10, 20, 15)
	require.True(t, ok)
	require.Equal(t, uint64(15), to)
	require.Equal(t, uint64(16), checkpoint)

	// At chain head: from == latest is a valid one-block inclusive query.
	to, checkpoint, ok = boundedBlockRange(15, 20, 15)
	require.True(t, ok)
	require.Equal(t, uint64(15), to)
	require.Equal(t, uint64(16), checkpoint)

	// Waiting ahead of head: never issues a reversed range.
	_, _, ok = boundedBlockRange(16, 20, 15)
	require.False(t, ok)
}
