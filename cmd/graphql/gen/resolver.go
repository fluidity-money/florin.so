package gen

import (
	"database/sql"
	"math/big"

	ethCommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

type Resolver struct {
	FeatureFakeData                          bool
	Db                                       *sql.DB
	AccPubKey                                [32]byte
	AddrBorrowerOperations, AddrSafetyRouter ethCommon.Address
	AddrAccountsFactory, AddrFaucet          ethCommon.Address
	AddrWeth                                 ethCommon.Address
	Client                                   *ethclient.Client
	ChainId                                  *big.Int
}
