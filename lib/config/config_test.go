package config

import (
	"fmt"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/require"
)

var requiredAddressEnvs = []string{
	"SPN_YEARN_VAULT_ADDR",
	"SPN_YEARN_VAULT_FACTORY_ADDR",
	"SPN_BOLD_TOKEN_ADDR",
	"SPN_COLLATERAL_REGISTRY_ADDR",
	"SPN_ADDRESSES_REGISTRY_ADDR",
	"SPN_ACTIVE_POOL_ADDR",
	"SPN_BORROWER_OPERATIONS_ADDR",
	"SPN_COLL_SURPLUS_POOL_ADDR",
	"SPN_DEFAULT_POOL_ADDR",
	"SPN_SORTED_TROVES_ADDR",
	"SPN_STABILITY_POOL_ADDR",
	"SPN_TROVE_MANAGER_ADDR",
	"SPN_TROVE_NFT_ADDR",
	"SPN_PRICE_FEED_ADDR",
}

func validEnvironment() map[string]string {
	env := map[string]string{
		"SPN_SUPERPOSITION_URL": "https://rpc.example,https://rpc2.example",
		"SPN_TIMESCALE":         "postgres://db1,postgres://db2",
	}
	for i, name := range requiredAddressEnvs {
		env[name] = fmt.Sprintf("0x%040x", i+1)
	}
	return env
}

func parseEnvironment(env map[string]string) (C, error) {
	return Parse(func(key string) string { return env[key] })
}

func TestParseNamedAddresses(t *testing.T) {
	env := validEnvironment()
	env["SPN_YEARN_VAULT_ADDR"] = " \t0xabcdefABCDEFabcdefABCDEFabcdefABCDEFabcd\n"
	c, err := parseEnvironment(env)
	require.NoError(t, err)
	require.Equal(t, 46630, c.ChainId)
	require.Equal(t, DefaultChainId, c.ChainId)
	require.Equal(t, []string{"https://rpc.example", "https://rpc2.example"}, c.GethUrls)
	require.Equal(t, []string{"postgres://db1", "postgres://db2"}, c.TimescaleUrls)
	fields := []common.Address{
		c.YearnVaultAddress, c.YearnVaultFactoryAddress, c.BoldTokenAddress,
		c.CollateralRegistryAddress, c.AddressesRegistryAddress, c.ActivePoolAddress,
		c.BorrowerOperationsAddress, c.CollSurplusPoolAddress, c.DefaultPoolAddress,
		c.SortedTrovesAddress, c.StabilityPoolAddress, c.TroveManagerAddress,
		c.TroveNFTAddress, c.PriceFeedAddress,
	}
	for i, name := range requiredAddressEnvs {
		require.Equal(t, common.HexToAddress(strings.TrimSpace(env[name])), fields[i], name)
	}
	require.Equal(t, fields[2:], c.LiquityAddresses())
	require.Zero(t, c.GovernanceAddress)
	addresses := c.LiquityAddresses()
	addresses[0] = common.Address{}
	require.Equal(t, c.BoldTokenAddress, c.LiquityAddresses()[0], "filter must not expose mutable config storage")
}

func TestParseRejectsMissingConfiguration(t *testing.T) {
	names := append([]string{"SPN_SUPERPOSITION_URL", "SPN_TIMESCALE"}, requiredAddressEnvs...)
	for _, name := range names {
		t.Run(name, func(t *testing.T) {
			env := validEnvironment()
			env[name] = " \t"
			_, err := parseEnvironment(env)
			require.ErrorContains(t, err, name)
			require.ErrorContains(t, err, "not set")
		})
	}
}

func TestParseRejectsInvalidConfiguredAddresses(t *testing.T) {
	names := append(append([]string{}, requiredAddressEnvs...), "SPN_GOVERNANCE_ADDR")
	for _, name := range names {
		for _, raw := range []string{
			"not-an-address", "0x1234", "0x" + strings.Repeat("g", 40),
			"0x" + strings.Repeat("1", 42),
			"0x0000000000000000000000000000000000000000",
			"0x1111111111111111111111111111111111111111,0x2222222222222222222222222222222222222222",
			"0x1111111111111111111111111111111111111111,",
		} {
			t.Run(name+"/"+raw, func(t *testing.T) {
				env := validEnvironment()
				env[name] = raw
				_, err := parseEnvironment(env)
				require.ErrorContains(t, err, name)
			})
		}
	}
}

func TestParseRejectsDuplicateAddressesAcrossRoles(t *testing.T) {
	names := append(append([]string{}, requiredAddressEnvs...), "SPN_GOVERNANCE_ADDR")
	for _, name := range names[1:] {
		t.Run(name, func(t *testing.T) {
			env := validEnvironment()
			env["SPN_YEARN_VAULT_ADDR"] = "0x" + strings.Repeat("ab", 20)
			env[name] = "0x" + strings.Repeat("AB", 20)
			_, err := parseEnvironment(env)
			require.ErrorContains(t, err, "duplicate address")
			require.ErrorContains(t, err, name)
			require.ErrorContains(t, err, "SPN_YEARN_VAULT_ADDR")
		})
	}
}

func TestOptionalGovernanceProxy(t *testing.T) {
	env := validEnvironment()
	env["SPN_GOVERNANCE_ADDR"] = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
	c, err := parseEnvironment(env)
	require.NoError(t, err)
	require.Equal(t, common.HexToAddress(env["SPN_GOVERNANCE_ADDR"]), c.GovernanceAddress)
	require.Len(t, c.LiquityAddresses(), 13)
	require.Equal(t, c.GovernanceAddress, c.LiquityAddresses()[12])
	require.NotContains(t, c.LiquityAddresses(), c.YearnVaultAddress)
	require.NotContains(t, c.LiquityAddresses(), c.YearnVaultFactoryAddress)
}

func TestLegacyAddressListIsNotUsed(t *testing.T) {
	env := validEnvironment()
	env["SPN_LIQUITY_ADDRS"] = "not-an-address"
	_, err := parseEnvironment(env)
	require.NoError(t, err, "legacy configuration must not be read")
	delete(env, "SPN_BOLD_TOKEN_ADDR")
	env["SPN_LIQUITY_ADDRS"] = "0x1111111111111111111111111111111111111111"
	_, err = parseEnvironment(env)
	require.ErrorContains(t, err, "SPN_BOLD_TOKEN_ADDR")
}
