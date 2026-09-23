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
