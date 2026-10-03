package weth

import (
	"strings"
	"math/big"

	ethAbi "github.com/ethereum/go-ethereum/accounts/abi"
	ethCommon "github.com/ethereum/go-ethereum/common"
)

var abi, _ = ethAbi.JSON(strings.NewReader(`[
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "recipient",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
]
`))

func MakeApproveCd(recipient ethCommon.Address, amt *big.Int) []byte {
	cd, err := abi.Pack("approve", recipient, amt)
	if err != nil {
		panic(err)
	}
	return cd
}
