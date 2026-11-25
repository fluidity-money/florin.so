// Copyright 2026 Fluid Assets Limited BVI. All rights reserved. Use of this
// source code is governed by a BUSL license that can be found in the
// LICENSE file.

package config

import (
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/common"
)

const DefaultChainId = 46630

type C struct {
	GethUrls      []string
	TimescaleUrls []string
	ChainId       int

	YearnVaultAddress         common.Address
	YearnVaultFactoryAddress  common.Address
	BoldTokenAddress          common.Address
	CollateralRegistryAddress common.Address
	AddressesRegistryAddress  common.Address
	ActivePoolAddress         common.Address
	BorrowerOperationsAddress common.Address
	CollSurplusPoolAddress    common.Address
	DefaultPoolAddress        common.Address
	SortedTrovesAddress       common.Address
	StabilityPoolAddress      common.Address
	TroveManagerAddress       common.Address
	TroveNFTAddress           common.Address
	PriceFeedAddress          common.Address
	// GovernanceAddress is the optional governance proxy, never its implementation.
	GovernanceAddress common.Address
}

func Get() C {
	c, err := Parse(os.Getenv)
	if err != nil {
		log.Fatal(err)
	}
	return c
}

// Parse reads named configuration using getenv without exiting the process.
// Every contract role is required except the governance proxy, which may be
// absent on deployments without governance. Configured roles must be distinct.
func Parse(getenv func(string) string) (C, error) {
	gethURL := strings.TrimSpace(getenv("SPN_SUPERPOSITION_URL"))
	if gethURL == "" {
		return C{}, fmt.Errorf("SPN_SUPERPOSITION_URL not set")
	}
	timescaleURL := strings.TrimSpace(getenv("SPN_TIMESCALE"))
	if timescaleURL == "" {
		return C{}, fmt.Errorf("SPN_TIMESCALE not set")
	}
	c := C{
		GethUrls:      strings.Split(gethURL, ","),
		TimescaleUrls: strings.Split(timescaleURL, ","),
		ChainId:       DefaultChainId,
	}
	roles := []struct {
		env      string
		address  *common.Address
		optional bool
	}{
		{"SPN_YEARN_VAULT_ADDR", &c.YearnVaultAddress, false},
		{"SPN_YEARN_VAULT_FACTORY_ADDR", &c.YearnVaultFactoryAddress, false},
		{"SPN_BOLD_TOKEN_ADDR", &c.BoldTokenAddress, false},
		{"SPN_COLLATERAL_REGISTRY_ADDR", &c.CollateralRegistryAddress, false},
		{"SPN_ADDRESSES_REGISTRY_ADDR", &c.AddressesRegistryAddress, false},
		{"SPN_ACTIVE_POOL_ADDR", &c.ActivePoolAddress, false},
		{"SPN_BORROWER_OPERATIONS_ADDR", &c.BorrowerOperationsAddress, false},
		{"SPN_COLL_SURPLUS_POOL_ADDR", &c.CollSurplusPoolAddress, false},
		{"SPN_DEFAULT_POOL_ADDR", &c.DefaultPoolAddress, false},
		{"SPN_SORTED_TROVES_ADDR", &c.SortedTrovesAddress, false},
		{"SPN_STABILITY_POOL_ADDR", &c.StabilityPoolAddress, false},
		{"SPN_TROVE_MANAGER_ADDR", &c.TroveManagerAddress, false},
		{"SPN_TROVE_NFT_ADDR", &c.TroveNFTAddress, false},
		{"SPN_PRICE_FEED_ADDR", &c.PriceFeedAddress, false},
		{"SPN_GOVERNANCE_ADDR", &c.GovernanceAddress, true},
	}
	for _, role := range roles {
		raw := strings.TrimSpace(getenv(role.env))
		if raw == "" && role.optional {
			continue
		}
		address, err := parseAddress(raw)
		if err != nil {
			return C{}, fmt.Errorf("%s: %w", role.env, err)
		}
		*role.address = address
	}
	return c, nil
}

// LiquityAddresses derives the RPC log filter from named emitting contracts.
// Yearn contracts are deliberately excluded; they have their own event routing.
func (c C) LiquityAddresses() []common.Address {
	addresses := []common.Address{
		c.BoldTokenAddress,
		c.CollateralRegistryAddress,
		c.AddressesRegistryAddress,
		c.ActivePoolAddress,
		c.BorrowerOperationsAddress,
		c.CollSurplusPoolAddress,
		c.DefaultPoolAddress,
		c.SortedTrovesAddress,
		c.StabilityPoolAddress,
		c.TroveManagerAddress,
		c.TroveNFTAddress,
		c.PriceFeedAddress,
	}
	if c.GovernanceAddress != (common.Address{}) {
		addresses = append(addresses, c.GovernanceAddress)
	}
	return addresses
}

func (c C) PickGethUrl() string {
	return c.GethUrls[rand.Intn(len(c.GethUrls))]
}

func (c C) PickTimescaleUrl() string {
	return c.TimescaleUrls[rand.Intn(len(c.TimescaleUrls))]
}

func parseAddress(raw string) (common.Address, error) {
	if raw == "" {
		return common.Address{}, fmt.Errorf("not set")
	}
	if !common.IsHexAddress(raw) {
		return common.Address{}, fmt.Errorf("invalid address %q: expected a single hex address", raw)
	}
	return common.HexToAddress(raw), nil
}
