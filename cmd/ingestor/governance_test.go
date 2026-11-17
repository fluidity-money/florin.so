package main

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	ethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/require"

	"github.com/fluidity-money/florin.so/lib/events/liquity"
	"github.com/fluidity-money/florin.so/lib/types/events"
)

func TestGovernanceRouting(t *testing.T) {
	proxy := common.HexToAddress("0xAbCDEF0123456789abcdef0123456789ABCDef01")
	implementation := common.HexToAddress("0xFeDCBA9876543210fedcba9876543210FEDCBA98")
	args := IngestorArgs{LiquityEmitters: []common.Address{proxy}}
	digest := common.HexToHash("0xabcdef")
	for _, tc := range []struct {
		signature, table string
		want             any
	}{
		{"OperationQueued(bytes32)", "liquity_events_operation_queued", &liquity.OperationQueued{Digest: digest.Hex()}},
		{"OperationExecuted(bytes32)", "liquity_events_operation_executed", &liquity.OperationExecuted{Digest: digest.Hex()}},
		{"OperationCancelled(bytes32)", "liquity_events_operation_cancelled", &liquity.OperationCancelled{Digest: digest.Hex()}},
		{"StorageWiped()", "liquity_events_storage_wiped", &liquity.StorageWiped{}},
		{"Upgraded(address)", "liquity_events_upgraded", &liquity.Upgraded{Implementation: events.AddressFromCommon(implementation)}},
	} {
		t.Run(tc.signature, func(t *testing.T) {
			sig := crypto.Keccak256Hash([]byte(tc.signature))
			require.Contains(t, FilterTopics(), sig)
			l := ethTypes.Log{Address: proxy, Topics: []common.Hash{sig}, BlockHash: common.HexToHash("0x1234"), TxHash: common.HexToHash("0x5678"), BlockNumber: 99}
			switch tc.signature {
			case "Upgraded(address)":
				l.Topics = append(l.Topics, common.BytesToHash(implementation.Bytes()))
			case "StorageWiped()":
			default:
				l.Data = digest.Bytes()
			}
			calls := 0
			changed, err := handleLogCallback(args, l, func(table string, event any) error {
				calls++
				require.Equal(t, tc.table, table)
				require.IsType(t, tc.want, event)
				v := reflect.ValueOf(event).Elem()
				require.Equal(t, events.Event{BlockHash: l.BlockHash.Hex(), TransactionHash: l.TxHash.Hex(), BlockNumber: 99, EmitterAddr: strings.ToLower(proxy.Hex())}, v.FieldByName("Event").Interface())
				// Compare payload separately so the expected envelope is not stamped
				// using the same reflection helper as the production path.
				v.FieldByName("Event").Set(reflect.ValueOf(events.Event{}))
				require.Equal(t, tc.want, event)
				return nil
			})
			require.NoError(t, err)
			require.True(t, changed)
			require.Equal(t, 1, calls)

			insertErr := errors.New("insert failed")
			changed, err = handleLogCallback(args, l, func(string, any) error { return insertErr })
			require.True(t, changed)
			require.ErrorIs(t, err, insertErr)

			noInsert := func(string, any) error { t.Fatal("unexpected insert"); return nil }
			unknown := l
			unknown.Address = implementation
			changed, err = handleLogCallback(args, unknown, noInsert)
			require.NoError(t, err)
			require.False(t, changed)
			changed, err = handleLogCallback(IngestorArgs{}, l, noInsert)
			require.NoError(t, err)
			require.False(t, changed)

			badData := l
			badData.Data = append(append([]byte{}, l.Data...), 0)
			badTopics := l
			badTopics.Topics = append(append([]common.Hash{}, l.Topics...), common.Hash{})
			missingTopics := l
			missingTopics.Topics = nil
			for _, bad := range []ethTypes.Log{badData, badTopics, missingTopics} {
				changed, err = handleLogCallback(args, bad, noInsert)
				require.ErrorContains(t, err, "decode Liquity event")
				require.False(t, changed)
			}
		})
	}
}
