// Copyright 2026 Fluid Assets Limited BVI. All rights reserved. Use of this
// source code is governed by a BUSL license that can be found in the
// LICENSE file.

package main

import "reflect"

// setEventFields stamps the shared event envelope onto a decoded event struct.
func setEventFields(a any, blockHash, transactionHash string, blockNo uint64, emitterAddr string) {
	value := reflect.ValueOf(a)
	for value.Kind() == reflect.Pointer || value.Kind() == reflect.Interface {
		value = value.Elem()
	}
	value.FieldByName("BlockHash").SetString(blockHash)
	value.FieldByName("TransactionHash").SetString(transactionHash)
	value.FieldByName("BlockNumber").SetUint(blockNo)
	value.FieldByName("EmitterAddr").SetString(emitterAddr)
}
