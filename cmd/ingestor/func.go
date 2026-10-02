package main

import (
	"log"
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"strings"
	"time"

	"github.com/fluidity-money/florin.so/lib/events/liquity"
	"github.com/fluidity-money/florin.so/lib/heartbeat"
	"github.com/fluidity-money/florin.so/lib/types"

	"github.com/ethereum/go-ethereum"
	ethCommon "github.com/ethereum/go-ethereum/common"
	ethTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"

	"gorm.io/gorm"
)

func FilterTopics() []ethCommon.Hash {
	return []ethCommon.Hash{
		liquity.TopicActivePoolAddressAdded,
		liquity.TopicActivePoolAddressChanged,
		liquity.TopicActivePoolBoldDebtUpdated,
		liquity.TopicActivePoolCollBalanceUpdated,
		liquity.TopicAddManagerUpdated,
		liquity.TopicBUpdated,
		liquity.TopicBaseRateUpdated,
		liquity.TopicBatchUpdated,
		liquity.TopicBatchedTroveUpdated,
		liquity.TopicBoldTokenAddressChanged,
		liquity.TopicBorrowerOperationsAddressAdded,
		liquity.TopicBorrowerOperationsAddressChanged,
		liquity.TopicCollBalanceUpdated,
		liquity.TopicCollSent,
		liquity.TopicCollSurplusPoolAddressChanged,
		liquity.TopicCollTokenAddressChanged,
		liquity.TopicCollateralRegistryAddressChanged,
		liquity.TopicDefaultPoolAddressChanged,
		liquity.TopicDefaultPoolBoldDebtUpdated,
		liquity.TopicDefaultPoolCollBalanceUpdated,
		liquity.TopicDepositOperation,
		liquity.TopicDepositUpdated,
		liquity.TopicGasPoolAddressChanged,
		liquity.TopicHintHelpersAddressChanged,
		liquity.TopicInterestRouterAddressChanged,
		liquity.TopicLastGoodPriceUpdated,
		liquity.TopicLastFeeOpTimeUpdated,
		liquity.TopicLiquidation,
		liquity.TopicMetadataNFTAddressChanged,
		liquity.TopicMultiTroveGetterAddressChanged,
		liquity.TopicOwnershipTransferred,
		liquity.TopicPUpdated,
		liquity.TopicPriceFeedAddressChanged,
		liquity.TopicRedemption,
		liquity.TopicRedemptionFeePaidToTrove,
		liquity.TopicRemoveManagerAndReceiverUpdated,
		liquity.TopicSUpdated,
		liquity.TopicScaleUpdated,
		liquity.TopicShutDownFromOracleFailure,
		liquity.TopicSortedTrovesAddressChanged,
		liquity.TopicStabilityPoolAddressAdded,
		liquity.TopicStabilityPoolAddressChanged,
		liquity.TopicStabilityPoolBoldBalanceUpdated,
		liquity.TopicStabilityPoolCollBalanceUpdated,
		liquity.TopicTroveManagerAddressAdded,
		liquity.TopicTroveManagerAddressChanged,
		liquity.TopicTroveNFTAddressChanged,
		liquity.TopicTroveOperation,
		liquity.TopicTroveUpdated,
		liquity.TopicWETHAddressChanged,
		liquity.TopicBoldTokenApproval,
		liquity.TopicBoldTokenTransfer,
		liquity.TopicTroveNFTApprovalForAll,
	}
}

type IngestorArgs struct {
	LiquityEmitters []ethCommon.Address
}

func (a IngestorArgs) isLiquityEmitter(address ethCommon.Address) bool {
	for _, emitter := range a.LiquityEmitters {
		if address == emitter {
			return true
		}
	}
	return false
}

func Entry(ingestorPagination int, pollWait int, c *ethclient.Client, db *gorm.DB, args IngestorArgs) {
	IngestPolling(c, db, ingestorPagination, pollWait, args)
}

// IngestPolling by repeatedly polling the RPC for changes to receive log
// updates. Assumes the ethclient is HTTP. Uses IngestBlockRange for the
// heavy lifting.
func IngestPolling(c *ethclient.Client, db *gorm.DB, ingestorPagination, pollWait int, args IngestorArgs) {
	if ingestorPagination <= 0 {
		panic("bad ingestor pagination")
	}
	for {
		from, err := getLastBlockCheckpointed(db)
		if err != nil {
			log.Fatalf("failed to get the last block checkpoint: %v", err)
		}
		to := from + uint64(ingestorPagination)
		slog.Info("latest block checkpoint",
			"from", from,
			"collecting until", to,
		)
		IngestBlockRange(c, db, from, to, args)
		slog.Info("about to sleep before polling again",
			"poll seconds", pollWait,
		)
		heartbeat.Pulse() // Report that we're alive.
		time.Sleep(time.Duration(pollWait) * time.Second)
	}
}

func boundedBlockRange(from, requestedTo, latest uint64) (to, checkpoint uint64, ok bool) {
	to = min(latest, requestedTo)
	if from > to {
		return 0, 0, false
	}
	return to, to + 1, true
}

func IngestBlockRange(c *ethclient.Client, db *gorm.DB, from, requestedTo uint64, args IngestorArgs) {
	latestBlockNo, err := c.BlockNumber(context.Background())
	if err != nil {
		log.Fatalf("failed to get latest block number: %v", err)
	}
	to, checkpoint, ok := boundedBlockRange(from, requestedTo, latestBlockNo)
	if !ok {
		slog.Debug("skipping because checkpoint is ahead of chain head",
			"from", from,
			"latest", latestBlockNo,
		)
		return
	}
	logs, err := c.FilterLogs(context.Background(), ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(from),
		ToBlock:   new(big.Int).SetUint64(to),
		Addresses: args.LiquityEmitters,
		Topics:    [][]ethCommon.Hash{FilterTopics()},
	})
	if err != nil {
		log.Fatalf("failed to filter Liquity logs: %v", err)
	}
	err = db.Transaction(func(db *gorm.DB) error {
		for _, log := range logs {
			if _, err := handleLog(db, args, log); err != nil {
				return fmt.Errorf("failed to unpack log: %v", err)
			}
		}
		if err := updateCheckpoint(db, checkpoint); err != nil {
			return fmt.Errorf("failed to update a checkpoint: %v", err)
		}
		return nil
	})
	if err != nil {
		log.Fatalf("failed to ingest logs into db: %v", err)
	}
	slog.Info("ingested block range", "from", from, "to", to)
}

func handleLog(db *gorm.DB, args IngestorArgs, l ethTypes.Log) (bool, error) {
	if len(l.Topics) == 0 {
		return false, nil
	}
	return handleLogCallback(args, l, func(table string, a any) error {
		return databaseInsertLog(db, table, a)
	})
}

type tableNamer interface {
	TableName() string
}

func handleLogCallback(args IngestorArgs, l ethTypes.Log, insert func(string, any) error) (bool, error) {
	if !args.isLiquityEmitter(l.Address) {
		return false, nil
	}
	event, err := liquity.UnpackLog(l)
	if err != nil {
		return false, fmt.Errorf("decode Liquity event: %w", err)
	}
	table, ok := event.(tableNamer)
	if !ok {
		return false, fmt.Errorf("liquity event %T does not declare a table", event)
	}
	emitterAddr := strings.ToLower(l.Address.String())
	setEventFields(
		event,
		l.BlockHash.String(),
		l.TxHash.String(),
		l.BlockNumber,
		emitterAddr,
	)
	return true, insert(table.TableName(), event)
}

func getLastBlockCheckpointed(db *gorm.DB) (uint64, error) {
	var c types.BlockCheckpoint
	err := db.Table("florin_ingestor_checkpointing_1").
		Where("id = ?", 1).
		Find(&c).
		Error
	if err != nil {
		return 0, err
	}
	if c.BlockNumber == 0 {
		return 0, fmt.Errorf("florin_ingestor_checkpointing_1 id not set")
	}
	return c.BlockNumber, nil
}

func updateCheckpoint(db *gorm.DB, blockNo uint64) error {
	// We observed a wicked Gorm bug here in 9lives, so we update explicitly here.
	err := db.Table("florin_ingestor_checkpointing_1").
		Where("id = 1").
		Update("last_updated", time.Now()).
		Update("block_number", blockNo).
		Error
	return err
}

func databaseInsertLog(db *gorm.DB, table string, a any) error {
	if err := db.Table(table).Omit("CreatedBy").Create(a).Error; err != nil {
		return fmt.Errorf("inserting log: %v", err)
	}
	return nil
}
