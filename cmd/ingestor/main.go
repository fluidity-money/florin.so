package main

import (
	"log"
	"log/slog"
	"math/rand"
	"os"
	"runtime/debug"
	"strings"

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

// EnvDebug to print logs.
const EnvDebug = "SPN_DEBUG"

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

func init() {
	logLevel := slog.LevelInfo
	if os.Getenv(EnvDebug) != "" {
		logLevel = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		Level: logLevel,
	}))
	var revision string
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, setting := range info.Settings {
			if setting.Key == "vcs.revision" {
				revision = setting.Value
				break
			}
		}
	}
	logger.
		With("revision", revision).
		With("environment", "backend").
		With("command line", strings.Join(os.Args, ",")).
		With("is debug", logLevel == slog.LevelDebug)
	slog.SetDefault(logger)
}
