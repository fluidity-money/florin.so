// Copyright 2026 Fluid Assets Limited BVI. All rights reserved. Use of this
// source code is governed by a BUSL license that can be found in the
// LICENSE file.

package weth

import (
	"math/big"
	"strings"

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
