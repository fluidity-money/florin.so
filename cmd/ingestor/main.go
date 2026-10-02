package main

import (
	"log/slog"
	"log"
	"math/rand"

	"github.com/fluidity-money/florin.so/lib/config"

	_ "github.com/lib/pq"

	gormSlog "github.com/orandin/slog-gorm"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/ethereum/go-ethereum/ethclient"
)

const (
	// DefaultPaginationBlockCountMin to use as the minimum number of blocks
	// to increase by.
	DefaultPaginationBlockCountMin = 1000

	// DefaultPaginationBlockCountMax to increase the last known block tracked
	// by with.
	DefaultPaginationBlockCountMax = 10_000

	// DefaultPaginationPollWait to wait between polls.
	DefaultPaginationPollWait = 5 // Seconds
)

func main() {
	cfg := config.Get()
	db, err := gorm.Open(postgres.Open(cfg.PickTimescaleUrl()), &gorm.Config{
		Logger: gormSlog.New(),
	})
	if err != nil {
		log.Fatalf("opening postgres: %v", err)
	}
	c, err := ethclient.Dial(cfg.PickGethUrl())
	if err != nil {
		log.Fatalf("rpc dial: %v", err)
	}
	defer c.Close()
	ingestorPagination := rand.Intn(DefaultPaginationBlockCountMax-DefaultPaginationBlockCountMin) + DefaultPaginationBlockCountMin
	slog.Info("polling configuration",
		"poll wait time amount", DefaultPaginationPollWait,
		"pagination block count min", DefaultPaginationBlockCountMin,
		"pagination block count max", DefaultPaginationBlockCountMax,
		"pagination count", ingestorPagination,
	)
	Entry(
		ingestorPagination,
		DefaultPaginationPollWait,
		c,
		db,
		IngestorArgs{LiquityEmitters: cfg.LiquityEmitters},
	)
}
