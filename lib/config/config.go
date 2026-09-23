package config

import (
	"fmt"
	"math/rand"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/fluidity-money/florin.so/lib/setup"
)

const DefaultChainId = 55244

type C struct {
	GethUrls        []string
	TimescaleUrls   []string
	ChainId         int
	LiquityEmitters []common.Address
}

func Get() C {
	gethURL := os.Getenv("SPN_SUPERPOSITION_URL")
	if gethURL == "" {
		setup.Exitf("SPN_SUPERPOSITION_URL not set")
	}
	timescaleURL := os.Getenv("SPN_TIMESCALE")
	if timescaleURL == "" {
		setup.Exitf("SPN_TIMESCALE not set")
	}
	liquityEmitters, err := parseAddresses(os.Getenv("SPN_LIQUITY_ADDRS"))
	if err != nil {
		setup.Exitf("SPN_LIQUITY_ADDRS: %v", err)
	}
	if len(liquityEmitters) == 0 {
		setup.Exitf("SPN_LIQUITY_ADDRS not set")
	}
	return C{
		GethUrls:        strings.Split(gethURL, ","),
		TimescaleUrls:   strings.Split(timescaleURL, ","),
		ChainId:         DefaultChainId,
		LiquityEmitters: liquityEmitters,
	}
}

func (c C) PickGethUrl() string {
	return c.GethUrls[rand.Intn(len(c.GethUrls))]
}

func (c C) PickTimescaleUrl() string {
	return c.TimescaleUrls[rand.Intn(len(c.TimescaleUrls))]
}

func parseAddresses(value string) ([]common.Address, error) {
	var addresses []common.Address
	for _, raw := range strings.Split(value, ",") {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		if !common.IsHexAddress(raw) {
			return nil, fmt.Errorf("invalid address %q", raw)
		}
		addresses = append(addresses, common.HexToAddress(raw))
	}
	return addresses, nil
}
