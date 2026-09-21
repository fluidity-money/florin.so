package config

import (
	"math/rand"
	"os"
	"strings"

	"github.com/fluidity-money/florin.so/ingest/lib/setup"
)

const DefaultChainId = 55244

type C struct {
	GethUrls []string
	ChainId  int
}

func Get() C {
	gethUrl := os.Getenv("SPN_SUPERPOSITION_URL")
	if gethUrl == "" {
		setup.Exitf("SPN_SUPERPOSITION_URL not set")
	}
	gethUrls := strings.Split(gethUrl, ",")
	return C{
		GethUrls: gethUrls,
		ChainId:  DefaultChainId,
	}
}

func (c C) PickGethUrl() string {
	return c.GethUrls[rand.Intn(len(c.GethUrls))]
}
