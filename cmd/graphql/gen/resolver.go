package gen

import (
	"database/sql"

	ethCommon "github.com/ethereum/go-ethereum/common"
)

type Resolver struct {
	FeatureFakeData bool
	DB              *sql.DB
	AccPubKey [32]byte
	AddrBorrowerOperations ethCommon.Address
}
