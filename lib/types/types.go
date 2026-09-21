package types

import "time"

// BlockCheckpoint tracks the highest ingested block number.
type BlockCheckpoint struct {
	ID          int
	LastUpdated time.Time
	BlockNumber uint64
}
