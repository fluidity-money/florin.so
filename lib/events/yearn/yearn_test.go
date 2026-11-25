// Copyright 2026 Fluid Assets Limited BVI. All rights reserved. Use of this
// source code is governed by a BUSL license that can be found in the
// LICENSE file.

package yearn

import (
	"bytes"
	"fmt"
	"math/big"
	"os"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/fluidity-money/florin.so/lib/types/events"
	"github.com/lib/pq"
)

type contractCase struct {
	abi    abi.ABI
	decode func(types.Log) (any, error)
}

func contracts() []contractCase {
	return []contractCase{{vaultABI, UnpackVaultLog}, {factoryABI, UnpackFactoryLog}}
}

func sampleValue(input abi.Argument, i int) any {
	switch input.Type.String() {
	case "address":
		return common.BytesToAddress(bytes.Repeat([]byte{byte(i + 1)}, 20))
	case "uint256":
		return new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(int64(i+1)))
	case "uint16":
		return uint16(65535 - i)
	case "bool":
		return true
	case "address[]":
		return []common.Address{common.HexToAddress("0xabcdef"), common.HexToAddress("0x123456")}
	default:
		panic(input.Type.String())
	}
}

func encodeLog(t *testing.T, event abi.Event, values []any) types.Log {
	t.Helper()
	log := types.Log{Topics: []common.Hash{event.ID}}
	var data []any
	for i, input := range event.Inputs {
		if input.Indexed {
			encoded, err := (abi.Arguments{{Type: input.Type}}).Pack(values[i])
			if err != nil {
				t.Fatal(err)
			}
			log.Topics = append(log.Topics, common.BytesToHash(encoded))
		} else {
			data = append(data, values[i])
		}
	}
	var err error
	log.Data, err = event.Inputs.NonIndexed().Pack(data...)
	if err != nil {
		t.Fatal(err)
	}
	return log
}

func samples(event abi.Event) []any {
	values := make([]any, len(event.Inputs))
	for i, input := range event.Inputs {
		values[i] = sampleValue(input, i)
	}
	return values
}

func TestEveryEvent(t *testing.T) {
	if ErrABI != nil {
		t.Fatal(ErrABI)
	}
	if len(vaultABI.Events) != 24 || len(factoryABI.Events) != 8 {
		t.Fatal("incomplete pinned ABI")
	}
	for _, contract := range contracts() {
		for name, event := range contract.abi.Events {
			t.Run(name, func(t *testing.T) {
				values := samples(event)
				log := encodeLog(t, event, values)
				got, err := contract.decode(log)
				if err != nil {
					t.Fatal(err)
				}
				v := reflect.ValueOf(got).Elem()
				if v.Type().Name() != name {
					t.Fatalf("got %T", got)
				}
				if v.NumField() != len(values)+1 {
					t.Fatal("field count")
				}
				if v.Field(0).Type() != reflect.TypeOf(events.Event{}) || !v.Field(0).IsZero() {
					t.Fatal("event envelope must remain unset")
				}
				for i, input := range event.Inputs {
					var want any = values[i]
					switch input.Type.String() {
					case "address":
						want = events.AddressFromCommon(values[i].(common.Address))
					case "uint256":
						want = events.NumberFromBig(values[i].(*big.Int))
					case "address[]":
						want = pq.StringArray{"0x0000000000000000000000000000000000abcdef", "0x0000000000000000000000000000000000123456"}
					}
					if !reflect.DeepEqual(v.Field(i+1).Interface(), want) {
						t.Errorf("%s: got %v want %v", input.Name, v.Field(i+1), want)
					}
				}
				bad := log
				bad.Topics = append(append([]common.Hash{}, log.Topics...), common.Hash{})
				if _, err := contract.decode(bad); err == nil {
					t.Error("extra topic accepted")
				}
				bad.Topics = log.Topics[:len(log.Topics)-1]
				if _, err := contract.decode(bad); err == nil {
					t.Error("missing topic accepted")
				}
				bad = log
				bad.Data = append(append([]byte{}, log.Data...), make([]byte, 32)...)
				if _, err := contract.decode(bad); err == nil {
					t.Error("trailing data accepted")
				}
				if len(log.Data) > 0 {
					bad.Data = log.Data[:len(log.Data)-1]
					if _, err := contract.decode(bad); err == nil {
						t.Error("truncated data accepted")
					}
				}
			})
		}
	}
}

func TestRoutingAndTopics(t *testing.T) {
	seen := make(map[common.Hash]bool)
	for _, topic := range FilterTopics() {
		if seen[topic] || topic == (common.Hash{}) {
			t.Fatal("duplicate/zero topic")
		}
		seen[topic] = true
	}
	if len(seen) != 32 {
		t.Fatal("missing signatures")
	}
	for _, contract := range contracts() {
		for _, event := range contract.abi.Events {
			if !seen[crypto.Keccak256Hash([]byte(event.Sig))] {
				t.Fatal("missing", event.Name)
			}
		}
		if got, err := contract.decode(types.Log{Topics: []common.Hash{common.HexToHash("0x42")}, Data: []byte{1}}); got != nil || err != nil {
			t.Fatal(got, err)
		}
		if _, err := contract.decode(types.Log{}); err == nil {
			t.Fatal("missing signature")
		}
	}
	if got, err := UnpackVaultLog(types.Log{Topics: []common.Hash{factoryABI.Events["NewVault"].ID}}); got != nil || err != nil {
		t.Fatal("factory routed to vault")
	}
	if got, err := UnpackFactoryLog(types.Log{Topics: []common.Hash{vaultABI.Events["Deposit"].ID}}); got != nil || err != nil {
		t.Fatal("vault routed to factory")
	}
	first := FilterTopics()
	first[0] = common.Hash{}
	if FilterTopics()[0] == (common.Hash{}) {
		t.Fatal("shared topic slice")
	}
}

func TestMalformedWords(t *testing.T) {
	for _, name := range []string{"UpdatePaused", "UpdateUseDefaultQueue", "UpdateAutoAllocate"} {
		event := vaultABI.Events[name]
		log := encodeLog(t, event, []any{true})
		log.Data[31] = 2
		if _, err := UnpackVaultLog(log); err == nil {
			t.Fatal("invalid bool", name)
		}
	}
	event := factoryABI.Events["UpdateProtocolFeeBps"]
	log := encodeLog(t, event, []any{uint16(1), uint16(2)})
	log.Data[29] = 1
	if _, err := UnpackFactoryLog(log); err == nil {
		t.Fatal("uint16 overflow")
	}
	log = encodeLog(t, vaultABI.Events["Deposit"], samples(vaultABI.Events["Deposit"]))
	log.Topics[1][0] = 1
	if _, err := UnpackVaultLog(log); err == nil {
		t.Fatal("dirty indexed address padding")
	}
}

func TestDynamicQueue(t *testing.T) {
	event := vaultABI.Events["UpdateDefaultQueue"]
	for _, length := range []int{0, 1, 10, 11} {
		t.Run(fmt.Sprint(length), func(t *testing.T) {
			addresses := make([]common.Address, length)
			for i := range addresses {
				addresses[i] = common.BytesToAddress([]byte{byte(i + 1)})
			}
			log := encodeLog(t, event, []any{addresses})
			got, err := UnpackVaultLog(log)
			if length > 10 {
				if err == nil {
					t.Fatal("overlong queue")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			queue := got.(*UpdateDefaultQueue).NewDefaultQueue
			if queue == nil || len(queue) != length {
				t.Fatal("queue length/nil")
			}
			for i := range addresses {
				if queue[i] != strings.ToLower(addresses[i].Hex()) {
					t.Fatal("queue order")
				}
			}
			value, err := queue.Value()
			if err != nil || value == nil {
				t.Fatal("array not SQL serializable")
			}
		})
	}
	original := encodeLog(t, event, []any{[]common.Address{common.HexToAddress("0x1234")}})
	for _, mutate := range []func([]byte){
		func(d []byte) { d[31] = 0 },
		func(d []byte) { d[31] = 33 },
		func(d []byte) { d[31] = 64 },
		func(d []byte) { d[32] = 255 },
		func(d []byte) { d[63] = 2 },
		func(d []byte) { d[64] = 1 },
	} {
		log := original
		log.Data = append([]byte{}, original.Data...)
		mutate(log.Data)
		if _, err := UnpackVaultLog(log); err == nil {
			t.Fatal("malformed dynamic data accepted")
		}
	}
}

func TestTableSchema(t *testing.T) {
	sql, err := os.ReadFile("../../../db/migrations/1795005000-yearn_events.sql")
	if err != nil {
		t.Fatal(err)
	}
	matches := regexp.MustCompile(`(?s)CREATE TABLE (\w+) \((.*?)\n\);`).FindAllStringSubmatch(string(sql), -1)
	tables := make(map[string]map[string]string)
	for _, match := range matches {
		columns := make(map[string]string)
		for _, line := range strings.Split(match[2], ",") {
			parts := strings.Fields(line)
			columns[parts[0]] = strings.Join(parts[1:], " ")
		}
		tables[match[1]] = columns
	}
	sqlTypes := map[reflect.Type]string{reflect.TypeOf(events.Address("")): "ADDRESS", reflect.TypeOf(events.Number{}): "HUGEINT", reflect.TypeOf(uint16(0)): "INTEGER", reflect.TypeOf(false): "BOOLEAN", reflect.TypeOf(pq.StringArray{}): "ADDRESS[]"}
	for _, contract := range contracts() {
		for _, event := range contract.abi.Events {
			got, err := contract.decode(encodeLog(t, event, samples(event)))
			if err != nil {
				t.Fatal(err)
			}
			name := got.(interface{ TableName() string }).TableName()
			columns, ok := tables[name]
			if !ok {
				t.Fatal("missing table", name)
			}
			delete(tables, name)
			for col, typ := range map[string]string{"id": "SERIAL PRIMARY KEY", "created_by": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP", "block_hash": "HASH NOT NULL", "transaction_hash": "HASH NOT NULL", "block_number": "INTEGER NOT NULL", "emitter_addr": "ADDRESS NOT NULL"} {
				if columns[col] != typ {
					t.Errorf("%s.%s: %s", name, col, columns[col])
				}
				delete(columns, col)
			}
			v := reflect.TypeOf(got).Elem()
			for i := 1; i < v.NumField(); i++ {
				field := v.Field(i)
				col := field.Tag.Get("json")
				if columns[col] != sqlTypes[field.Type]+" NOT NULL" {
					t.Errorf("%s.%s: SQL %s vs Go %s", name, col, columns[col], field.Type)
				}
				delete(columns, col)
			}
			if len(columns) != 0 {
				t.Fatal("unexpected columns", columns)
			}
		}
	}
	if len(tables) != 0 {
		t.Fatal("unexpected tables", tables)
	}
}
