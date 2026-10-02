package types

import (
	_ "embed"
	"bytes"
	"math/big"

	"github.com/ethereum/go-ethereum/ethclient"
	ethCommon "github.com/ethereum/go-ethereum/common"
	ethAbi "github.com/ethereum/go-ethereum/accounts/abi"
)

//go:embed abi.json
var abiB []byte

var abi, _ = ethAbi.JSON(bytes.NewReader(abiB))

func MakeOpenTroveCd(
	c *ethclient.Client,
	owner ethCommon.Address,
	ownerIndex *big.Int,
	collAmt, boldAmt *big.Int,
	upperHint, lowerHint *big.Int,
	annualInterestRate, maxUpfrontFee *big.Int,
	addManager, removeManager ethCommon.Address,
	receiver ethCommon.Address,
) ([]byte, error) {
	return abi.Pack("openTrove",
		owner,
		ownerIndex,
		collAmt,
		boldAmt,
		upperHint,
		lowerHint,
		annualInterestRate,
		maxUpfrontFee,
		addManager,
		removeManager,
		receiver,
	)
}
