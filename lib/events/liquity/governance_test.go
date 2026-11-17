package liquity

import (
	"reflect"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	gethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/fluidity-money/florin.so/lib/types/events"
	"github.com/stretchr/testify/require"
)

func TestGovernanceDecoders(t *testing.T) {
	require.NoError(t, ErrABI)
	digest := common.HexToHash("0xabcdef0123456789")
	implementation := common.HexToAddress("0xaBcDEF0123456789aBCDef0123456789AbcDEF01")
	cases := []struct {
		name, signature, table string
		topic                  common.Hash
		decode                 decoder
		want                   any
	}{
		{"OperationQueued", "OperationQueued(bytes32)", "liquity_events_operation_queued", TopicOperationQueued, func(t []common.Hash, d []byte) (any, error) { return UnpackOperationQueued(t, d) }, &OperationQueued{Digest: digest.Hex()}},
		{"OperationExecuted", "OperationExecuted(bytes32)", "liquity_events_operation_executed", TopicOperationExecuted, func(t []common.Hash, d []byte) (any, error) { return UnpackOperationExecuted(t, d) }, &OperationExecuted{Digest: digest.Hex()}},
		{"OperationCancelled", "OperationCancelled(bytes32)", "liquity_events_operation_cancelled", TopicOperationCancelled, func(t []common.Hash, d []byte) (any, error) { return UnpackOperationCancelled(t, d) }, &OperationCancelled{Digest: digest.Hex()}},
		{"StorageWiped", "StorageWiped()", "liquity_events_storage_wiped", TopicStorageWiped, func(t []common.Hash, d []byte) (any, error) { return UnpackStorageWiped(t, d) }, &StorageWiped{}},
		{"Upgraded", "Upgraded(address)", "liquity_events_upgraded", TopicUpgraded, func(t []common.Hash, d []byte) (any, error) { return UnpackUpgraded(t, d) }, &Upgraded{Implementation: events.AddressFromCommon(implementation)}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Build wire logs independently of the embedded ABI and exported topics.
			sig := crypto.Keccak256Hash([]byte(tc.signature))
			require.Equal(t, sig, tc.topic)
			require.Contains(t, Topics(), sig)
			topics := []common.Hash{sig}
			var data []byte
			if tc.name == "Upgraded" {
				topics = append(topics, common.BytesToHash(implementation.Bytes()))
			} else if tc.name != "StorageWiped" {
				data = digest.Bytes()
			}
			got, err := tc.decode(topics, data)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
			require.Equal(t, tc.table, got.(interface{ TableName() string }).TableName())
			got, err = UnpackLog(gethTypes.Log{Topics: topics, Data: data})
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
			if len(data) == 32 {
				got, err = tc.decode(topics, make([]byte, 32))
				require.NoError(t, err)
				require.Equal(t, (common.Hash{}).Hex(), reflect.ValueOf(got).Elem().FieldByName("Digest").String())
			}
			for _, n := range []int{0, 1, 31, 32, 33, 64} {
				if n == len(data) {
					continue
				}
				_, err := tc.decode(topics, make([]byte, n))
				require.Error(t, err, "data length %d", n)
				_, err = UnpackLog(gethTypes.Log{Topics: topics, Data: make([]byte, n)})
				require.Error(t, err)
			}
			for _, bad := range [][]common.Hash{nil, topics[:len(topics)-1], append(append([]common.Hash{}, topics...), common.Hash{}), {common.HexToHash("0xdead")}} {
				_, err := tc.decode(bad, data)
				require.Error(t, err)
				_, err = UnpackLog(gethTypes.Log{Topics: bad, Data: data})
				require.Error(t, err)
			}
		})
	}
}
