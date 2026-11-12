// yield-cron copies the current APR view into the history table once, then exits.
// Invoke it from an external scheduler; it makes no chain/RPC calls.
package main

import (
	"database/sql"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	db, err := sql.Open("postgres", os.Getenv("SPN_TIMESCALE"))
	if err != nil {
		panic(err)
	}
	defer db.Close()
	_, err = db.Exec(`
INSERT INTO florin_stability_pool_apr_history_1 (
	stability_pool, as_of_block, as_of_block_hash, as_of_timestamp,
	apr_24h, apr_7d, baseline_24h_timestamp, baseline_7d_timestamp,
	status_24h, status_7d
)
SELECT
	stability_pool, as_of_block, as_of_block_hash, as_of_timestamp,
	apr_24h, apr_7d, baseline_24h_timestamp, baseline_7d_timestamp,
	status_24h, status_7d
FROM florin_stability_pool_apr_1;`,
	)
	if err != nil {
		panic(err)
	}
}
