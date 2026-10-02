package types

import (
	"bytes"
	_ "embed"
	"math/big"

	ethAbi "github.com/ethereum/go-ethereum/accounts/abi"
	ethCommon "github.com/ethereum/go-ethereum/common"
)

//go:embed abi.json
var abiB []byte

var abi, _ = ethAbi.JSON(bytes.NewReader(abiB))

func MakeOpenTroveCd(
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

func MakeFindInsertPositionCd(
	annualInterestRate *big.Int,
	prevId, nextId *big.Int,
) ([]byte, error) {
	return abi.Pack("findInsertPosition",
		annualInterestRate,
		prevId, nextId,
	)
}
