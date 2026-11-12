// interest: go on-chain to get fee data and uses the historical data
// in the database for the stability pool and active pool given.

package main

import (
	"database/sql"
	"fmt"
	"context"
	"math/big"
	"encoding/hex"
	"os"

	"github.com/fluidity-money/florin.so/lib/types/events"

	_ "github.com/lib/pq"

	ethCommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	var (
		stabilityPoolAddr = ethCommon.HexToAddress(os.Getenv("SPN_STABILITY_POOL"))
		activePoolAddr    = ethCommon.HexToAddress(os.Getenv("SPN_ACTIVE_POOL"))
	)
	c, err := ethclient.Dial(os.Getenv("SPN_GETH_URL"))
	if err != nil {
		panic(err)
	}
	defer c.Close()
	db, err := sql.Open("postgres", os.Getenv("SPN_TIMESCALE"))
	if err != nil {
		panic(err)
	}
	defer db.Close()
	weightedDebtSum, err := getWeightedDebtSum(c, activePoolAddr)
	if err != nil {
		panic(err)
	}
	totalBoldDeposits, err := getTotalBoldDeposits(c, stabilityPoolAddr)
	if err != nil {
		panic(err)
	}
	r := db.QueryRow(`
WITH fees AS (
	SELECT
		debt_increase_from_upfront_fee AS amount
	FROM liquity_events_trove_operation
	WHERE debt_increase_from_upfront_fee > 0
		AND created_by >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
		AND created_by <= CURRENT_TIMESTAMP
	UNION ALL
	SELECT
		debt_increase_from_upfront_fee AS amount
	FROM liquity_events_batch_updated
	WHERE operation = 2
		AND debt_increase_from_upfront_fee > 0
		AND created_by >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
		AND created_by <= CURRENT_TIMESTAMP
)
SELECT
	div(COALESCE(SUM(f.amount), 0) * 75, 100)
		AS upfront_fees_pool_share_raw
FROM fees f`,
	)
	var feesCollectedLast24Hours events.Number
	if err := r.Scan(&feesCollectedLast24Hours); err != nil {
		panic(err)
	}
	//interestAPR18 = weightedDebtSum * 75 / (100 * totalBoldDeposits)
	//feesAPR18 = 365 * feesCollectedLast24Hours * 1e18 / totalBoldDeposits
	precision := big.NewInt(1_000_000_000_000_000_000)
	interestNumerator := new(big.Int).Mul(weightedDebtSum, big.NewInt(75))
	interestDenominator := new(big.Int).Mul(totalBoldDeposits, big.NewInt(100))
	interestApr18 := new(big.Int).Quo(interestNumerator, interestDenominator)
	feesNumerator := new(big.Int).Mul(feesCollectedLast24Hours.Big(), big.NewInt(365))
	feesNumerator.Mul(feesNumerator, precision)
	feesApr18 := new(big.Int).Quo(feesNumerator, totalBoldDeposits)
	apr := events.NumberFromBig(new(big.Int).Add(interestApr18, feesApr18))
	_, err = db.Exec(`
INSERT INTO florin_apr_recorded_1 (stability_pool, active_pool, apr) VALUES ($1, $2, $3 / 1e18)`,
		stabilityPoolAddr.String(),
		activePoolAddr.String(),
		apr,
	)
	if err != nil {
		panic(err)
	}
}

func getWeightedDebtSum(c *ethclient.Client, activePool ethCommon.Address) (*big.Int, error) {
	cd, _ := hex.DecodeString("42635a95")
	rd, err := c.CallContract(context.Background(),
		ethereum.CallMsg{
			To:   &activePool,
			Data: cd,
		},
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("call activepool: %v", err)
	}
	return new(big.Int).SetBytes(rd), nil
}

func getTotalBoldDeposits(c *ethclient.Client, stabilityPool ethCommon.Address) (*big.Int, error) {
	cd, _ := hex.DecodeString("f71c6940")
	rd, err := c.CallContract(context.Background(),
		ethereum.CallMsg{
			To:   &stabilityPool,
			Data: cd,
		},
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("call stabilitypool: %v", err)
	}
	return new(big.Int).SetBytes(rd), nil
}
