package config

import (
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
)

func TestParseAddresses(t *testing.T) {
	addresses, err := parseAddresses(" 0x1111111111111111111111111111111111111111,0x2222222222222222222222222222222222222222 ")
	require.NoError(t, err)
	require.Equal(t, []common.Address{
		common.HexToAddress("0x1111111111111111111111111111111111111111"),
		common.HexToAddress("0x2222222222222222222222222222222222222222"),
	}, addresses)
}

func TestParseAddressesRejectsInvalidAddress(t *testing.T) {
	_, err := parseAddresses("not-an-address")
	require.ErrorContains(t, err, "invalid address")
}
