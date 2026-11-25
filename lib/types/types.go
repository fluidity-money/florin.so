// Copyright 2026 Fluid Assets Limited BVI. All rights reserved. Use of this
// source code is governed by a BUSL license that can be found in the
// LICENSE file.

package types

import "time"

// BlockCheckpoint tracks the highest ingested block number.
type BlockCheckpoint struct {
	ID          int
	LastUpdated time.Time
	BlockNumber uint64
}
