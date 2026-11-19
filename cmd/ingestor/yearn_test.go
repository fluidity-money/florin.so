package main

import (
	"errors"
	"math/big"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	ethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/fluidity-money/florin.so/lib/config"
	"github.com/fluidity-money/florin.so/lib/events/liquity"
	"github.com/fluidity-money/florin.so/lib/events/yearn"
	"github.com/fluidity-money/florin.so/lib/types/events"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func yearnRoutingArgs() IngestorArgs {
	return IngestorArgs{Contracts: config.C{
		YearnVaultAddress:        common.HexToAddress("0xaBcD01"),
		YearnVaultFactoryAddress: common.HexToAddress("0xaBcD02"),
		BoldTokenAddress:         common.HexToAddress("0xaBcD03"),
		TroveNFTAddress:          common.HexToAddress("0xaBcD04"),
		ActivePoolAddress:        common.HexToAddress("0xaBcD05"),
	}}
}

// Signatures and word layouts are independent fixtures, not production topic constants.
func yearnRoutingLog(address common.Address, signature string, indexed []common.Hash, data []byte) ethTypes.Log {
	return ethTypes.Log{
		Address:     address,
		Topics:      append([]common.Hash{crypto.Keccak256Hash([]byte(signature))}, indexed...),
		Data:        data,
		BlockHash:   common.HexToHash("0xabcdef1234"),
		TxHash:      common.HexToHash("0xfedcba5678"),
		BlockNumber: 12345,
	}
}

func TestYearnCallbackRouting(t *testing.T) {
	args := yearnRoutingArgs()
	from, to := common.HexToAddress("0xabc123"), common.HexToAddress("0xdef456")
	indexed := []common.Hash{common.BytesToHash(from.Bytes()), common.BytesToHash(to.Bytes())}
	amount := big.NewInt(987654321)
	word := common.BigToHash(amount)
	nftIndexed := append(append([]common.Hash{}, indexed...), word)
	fromEvent, toEvent := events.AddressFromCommon(from), events.AddressFromCommon(to)
	number := events.NumberFromBig(amount)
	queueType, err := abi.NewType("address[]", "", nil)
	require.NoError(t, err)
	queueData, err := (abi.Arguments{{Type: queueType}}).Pack([]common.Address{to, from})
	require.NoError(t, err)
	for _, tc := range []struct {
		name  string
		log   ethTypes.Log
		table string
		want  any
	}{
		{"vault transfer", yearnRoutingLog(args.Contracts.YearnVaultAddress, "Transfer(address,address,uint256)", indexed, word.Bytes()), "yearn_events_transfer", &yearn.Transfer{Sender: fromEvent, Receiver: toEvent, Value: number}},
		{"vault approval", yearnRoutingLog(args.Contracts.YearnVaultAddress, "Approval(address,address,uint256)", indexed, word.Bytes()), "yearn_events_approval", &yearn.Approval{Owner: fromEvent, Spender: toEvent, Value: number}},
		{"BOLD transfer", yearnRoutingLog(args.Contracts.BoldTokenAddress, "Transfer(address,address,uint256)", indexed, word.Bytes()), "liquity_events_bold_token_transfer", &liquity.BoldTokenTransfer{FromAddress: fromEvent, ToAddress: toEvent, Value: number}},
		{"BOLD approval", yearnRoutingLog(args.Contracts.BoldTokenAddress, "Approval(address,address,uint256)", indexed, word.Bytes()), "liquity_events_bold_token_approval", &liquity.BoldTokenApproval{Owner: fromEvent, Spender: toEvent, Value: number}},
		{"NFT transfer", yearnRoutingLog(args.Contracts.TroveNFTAddress, "Transfer(address,address,uint256)", nftIndexed, nil), "liquity_events_trove_nft_transfer", &liquity.TroveNFTTransfer{FromAddress: fromEvent, ToAddress: toEvent, TokenID: number}},
		{"NFT approval", yearnRoutingLog(args.Contracts.TroveNFTAddress, "Approval(address,address,uint256)", nftIndexed, nil), "liquity_events_trove_nft_approval", &liquity.TroveNFTApproval{Owner: fromEvent, Approved: toEvent, TokenID: number}},
		{"factory new vault", yearnRoutingLog(args.Contracts.YearnVaultFactoryAddress, "NewVault(address,address)", indexed, nil), "yearn_events_new_vault", &yearn.NewVault{VaultAddress: fromEvent, Asset: toEvent}},
		{"vault dynamic queue", yearnRoutingLog(args.Contracts.YearnVaultAddress, "UpdateDefaultQueue(address[])", nil, queueData), "yearn_events_update_default_queue", &yearn.UpdateDefaultQueue{NewDefaultQueue: pq.StringArray{toEvent.String(), fromEvent.String()}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			changed, err := handleLogCallback(args, tc.log, func(table string, event any) error {
				calls++
				require.Equal(t, tc.table, table)
				require.IsType(t, tc.want, event)
				value := reflect.ValueOf(event).Elem()
				require.Equal(t, events.Event{
					BlockHash: tc.log.BlockHash.Hex(), TransactionHash: tc.log.TxHash.Hex(),
					BlockNumber: tc.log.BlockNumber, EmitterAddr: strings.ToLower(tc.log.Address.Hex()),
				}, value.FieldByName("Event").Interface())
				value.FieldByName("Event").Set(reflect.ValueOf(events.Event{}))
				require.Equal(t, tc.want, event)
				return nil
			})
			require.NoError(t, err)
			require.True(t, changed)
			require.Equal(t, 1, calls)

			insertErr := errors.New("test insert failed")
			calls = 0
			changed, err = handleLogCallback(args, tc.log, func(table string, event any) error {
				calls++
				require.Equal(t, tc.table, table)
				return insertErr
			})
			require.True(t, changed)
			require.ErrorIs(t, err, insertErr)
			require.Equal(t, 1, calls)
		})
	}
}

func TestYearnRoutingIgnoresWrongEmittersAndUnknownTopics(t *testing.T) {
	args := yearnRoutingArgs()
	indexed := []common.Hash{common.HexToHash("0x1234"), common.HexToHash("0x5678")}
	word := common.HexToHash("0x42")
	for _, tc := range []struct {
		name      string
		address   common.Address
		signature string
	}{
		{"vault unknown", args.Contracts.YearnVaultAddress, "Unknown()"},
		{"factory unknown", args.Contracts.YearnVaultFactoryAddress, "Unknown()"},
		{"vault factory event", args.Contracts.YearnVaultAddress, "NewVault(address,address)"},
		{"factory vault event", args.Contracts.YearnVaultFactoryAddress, "UpdateDefaultQueue(address[])"},
		{"factory ERC20 transfer", args.Contracts.YearnVaultFactoryAddress, "Transfer(address,address,uint256)"},
		{"factory ERC20 approval", args.Contracts.YearnVaultFactoryAddress, "Approval(address,address,uint256)"},
		{"unconfigured emitter", common.HexToAddress("0x9999"), "Transfer(address,address,uint256)"},
		{"zero emitter", common.Address{}, "Transfer(address,address,uint256)"},
		{"unrelated role transfer", args.Contracts.ActivePoolAddress, "Transfer(address,address,uint256)"},
		{"unrelated role approval", args.Contracts.ActivePoolAddress, "Approval(address,address,uint256)"},
		{"unrelated role NFT approval for all", args.Contracts.ActivePoolAddress, "ApprovalForAll(address,address,bool)"},
		{"BOLD NFT approval for all", args.Contracts.BoldTokenAddress, "ApprovalForAll(address,address,bool)"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// Try both ERC20 and NFT topic layouts; emitter gating must precede decoding.
			for _, topics := range [][]common.Hash{indexed, append(append([]common.Hash{}, indexed...), word)} {
				l := yearnRoutingLog(tc.address, tc.signature, topics, word.Bytes())
				changed, err := handleLogCallback(args, l, func(string, any) error {
					t.Fatal("ignored log attempted an insert")
					return nil
				})
				require.NoError(t, err)
				require.False(t, changed)
			}
		})
	}
}

func TestYearnRoutingMalformedKnownLogsDoNotInsert(t *testing.T) {
	args := yearnRoutingArgs()
	indexed := []common.Hash{common.HexToHash("0x1234"), common.HexToHash("0x5678")}
	for _, tc := range []struct {
		name string
		log  ethTypes.Log
	}{
		{"vault short transfer", yearnRoutingLog(args.Contracts.YearnVaultAddress, "Transfer(address,address,uint256)", indexed, []byte{1})},
		{"vault short approval", yearnRoutingLog(args.Contracts.YearnVaultAddress, "Approval(address,address,uint256)", indexed, []byte{1})},
		{"vault missing indexed topic", yearnRoutingLog(args.Contracts.YearnVaultAddress, "Transfer(address,address,uint256)", indexed[:1], make([]byte, 32))},
		{"vault NFT layout", yearnRoutingLog(args.Contracts.YearnVaultAddress, "Transfer(address,address,uint256)", append(append([]common.Hash{}, indexed...), common.Hash{}), nil)},
		{"factory unexpected data", yearnRoutingLog(args.Contracts.YearnVaultFactoryAddress, "NewVault(address,address)", indexed, []byte{1})},
		{"factory missing indexed topic", yearnRoutingLog(args.Contracts.YearnVaultFactoryAddress, "NewVault(address,address)", indexed[:1], nil)},
		{"queue invalid offset", yearnRoutingLog(args.Contracts.YearnVaultAddress, "UpdateDefaultQueue(address[])", nil, common.HexToHash("0xffff").Bytes())},
		{"BOLD short data", yearnRoutingLog(args.Contracts.BoldTokenAddress, "Transfer(address,address,uint256)", indexed, []byte{1})},
		{"NFT ERC20 layout", yearnRoutingLog(args.Contracts.TroveNFTAddress, "Transfer(address,address,uint256)", indexed, make([]byte, 32))},
	} {
		t.Run(tc.name, func(t *testing.T) {
			changed, err := handleLogCallback(args, tc.log, func(string, any) error {
				t.Fatal("malformed log attempted an insert")
				return nil
			})
			require.Error(t, err)
			require.False(t, changed)
		})
	}
}

func TestYearnIngestorFilterTopics(t *testing.T) {
	topics := FilterTopics()
	seen := make(map[common.Hash]bool)
	for _, topic := range topics {
		require.False(t, seen[topic], "duplicate topic %s", topic)
		seen[topic] = true
	}
	for _, topic := range yearn.FilterTopics() {
		require.Contains(t, topics, topic)
	}
	// Also check the checked-in ABIs independently of yearn.FilterTopics.
	for _, path := range []string{"../../lib/events/yearn/vault-abi.json", "../../lib/events/yearn/factory-abi.json"} {
		data, err := os.ReadFile(path)
		require.NoError(t, err)
		contract, err := abi.JSON(strings.NewReader(string(data)))
		require.NoError(t, err)
		require.NotEmpty(t, contract.Events)
		for name, event := range contract.Events {
			require.Contains(t, topics, event.ID, "%s: %s", path, name)
		}
	}
}

func TestYearnIngestorAddressesUseNamedRoles(t *testing.T) {
	var c config.C
	roles := []*common.Address{
		&c.YearnVaultAddress, &c.YearnVaultFactoryAddress, &c.BoldTokenAddress,
		&c.CollateralRegistryAddress, &c.AddressesRegistryAddress, &c.ActivePoolAddress,
		&c.BorrowerOperationsAddress, &c.CollSurplusPoolAddress, &c.DefaultPoolAddress,
		&c.SortedTrovesAddress, &c.StabilityPoolAddress, &c.TroveManagerAddress,
		&c.TroveNFTAddress, &c.PriceFeedAddress, &c.GovernanceAddress,
	}
	want := make([]common.Address, len(roles))
	for i, role := range roles {
		*role = common.BigToAddress(big.NewInt(int64(i + 1)))
		want[i] = *role
	}
	require.ElementsMatch(t, want, (IngestorArgs{Contracts: c}).addresses())
	// Each named role works on its own, even with all other roles unset.
	for i := range roles {
		for j, role := range roles {
			*role = common.Address{}
			if i == j {
				*role = want[j]
			}
		}
		require.Equal(t, []common.Address{want[i]}, (IngestorArgs{Contracts: c}).addresses())
	}
	require.Empty(t, (IngestorArgs{}).addresses())
}
