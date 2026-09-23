package liquity

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	gethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/stretchr/testify/require"

	"github.com/fluidity-money/florin.so/lib/types/events"
)

func topicAddress(address common.Address) common.Hash {
	return common.BytesToHash(common.LeftPadBytes(address.Bytes(), 32))
}

func topicNumber(number *big.Int) common.Hash {
	return common.BigToHash(number)
}

func TestEmbeddedABIs(t *testing.T) {
	require.NoError(t, ErrABI)
	require.Len(t, mainABI.Events, 50)
	require.Len(t, boldTokenABI.Events, 2)
	require.Len(t, troveNFTABI.Events, 3)
	require.Len(t, Topics(), 53) // ERC-20 and ERC-721 Approval/Transfer share signatures.
}

func TestEveryABIEventDecodes(t *testing.T) {
	contracts := []struct {
		name string
		abi  abi.ABI
	}{
		{"liquity", mainABI},
		{"bold-token", boldTokenABI},
		{"trove-nft", troveNFTABI},
	}
	for _, contract := range contracts {
		for name, eventABI := range contract.abi.Events {
			t.Run(contract.name+"/"+name, func(t *testing.T) {
				topics := []common.Hash{eventABI.ID}
				var values []any
				for _, input := range eventABI.Inputs {
					value := zeroABIValue(input.Type)
					if input.Indexed {
						switch value := value.(type) {
						case common.Address:
							topics = append(topics, topicAddress(value))
						case *big.Int:
							topics = append(topics, topicNumber(value))
						}
					} else {
						values = append(values, value)
					}
				}
				data, err := eventABI.Inputs.NonIndexed().Pack(values...)
				require.NoError(t, err)
				decoded, err := UnpackLog(gethTypes.Log{Topics: topics, Data: data})
				require.NoError(t, err)
				require.NotNil(t, decoded)
			})
		}
	}
}

func zeroABIValue(typ abi.Type) any {
	switch typ.T {
	case abi.AddressTy:
		return common.Address{}
	case abi.IntTy, abi.UintTy:
		if typ.Size <= 8 {
			return uint8(0)
		}
		return new(big.Int)
	case abi.BoolTy:
		return false
	default:
		panic("unsupported test ABI type: " + typ.String())
	}
}

func TestUnpackTroveOperation(t *testing.T) {
	troveID := big.NewInt(42)
	input := mainABI.Events["TroveOperation"]
	data, err := input.Inputs.NonIndexed().Pack(
		uint8(3),
		big.NewInt(25),
		big.NewInt(10),
		big.NewInt(2),
		big.NewInt(-7),
		big.NewInt(4),
		big.NewInt(-1),
	)
	require.NoError(t, err)

	decoded, err := UnpackLog(gethTypes.Log{
		Topics: []common.Hash{TopicTroveOperation, topicNumber(troveID)},
		Data:   data,
	})
	require.NoError(t, err)

	event, ok := decoded.(*TroveOperation)
	require.True(t, ok)
	require.Equal(t, "42", event.TroveID.String())
	require.Equal(t, uint8(3), event.Operation)
	require.Equal(t, "-7", event.DebtChangeFromOperation.String())
	require.Equal(t, "-1", event.CollChangeFromOperation.String())
	require.Equal(t, "liquity_events_trove_operation", event.TableName())
}

func TestUnpackLogDistinguishesTokenStandards(t *testing.T) {
	owner := common.HexToAddress("0x1111111111111111111111111111111111111111")
	spender := common.HexToAddress("0x2222222222222222222222222222222222222222")

	erc20Data, err := boldTokenABI.Events["Approval"].Inputs.NonIndexed().Pack(big.NewInt(100))
	require.NoError(t, err)
	erc20, err := UnpackLog(gethTypes.Log{
		Topics: []common.Hash{TopicBoldTokenApproval, topicAddress(owner), topicAddress(spender)},
		Data:   erc20Data,
	})
	require.NoError(t, err)
	approval, ok := erc20.(*BoldTokenApproval)
	require.True(t, ok)
	require.Equal(t, events.AddressFromCommon(owner), approval.Owner)
	require.Equal(t, "100", approval.Value.String())

	erc721, err := UnpackLog(gethTypes.Log{
		Topics: []common.Hash{
			TopicTroveNFTApproval,
			topicAddress(owner),
			topicAddress(spender),
			topicNumber(big.NewInt(7)),
		},
	})
	require.NoError(t, err)
	nftApproval, ok := erc721.(*TroveNFTApproval)
	require.True(t, ok)
	require.Equal(t, "7", nftApproval.TokenID.String())
}

func TestUnpackLogRejectsUnknownTopic(t *testing.T) {
	_, err := UnpackLog(gethTypes.Log{Topics: []common.Hash{common.HexToHash("0xdeadbeef")}})
	require.ErrorContains(t, err, "unknown Liquity event topic")
}
