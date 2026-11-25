// Copyright 2026 Fluid Assets Limited BVI. All rights reserved. Use of this
// source code is governed by a BUSL license that can be found in the
// LICENSE file.

// Package yearn decodes the pinned Yearn V3 vault and factory event ABIs.
package yearn

import (
	"bytes"
	_ "embed"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

//go:embed vault-abi.json
var vaultABIJSON string

//go:embed factory-abi.json
var factoryABIJSON string

var (
	vaultABI, vaultABIErr     = abi.JSON(strings.NewReader(vaultABIJSON))
	factoryABI, factoryABIErr = abi.JSON(strings.NewReader(factoryABIJSON))
	// ErrABI reports invalid embedded ABIs and must be checked at startup.
	ErrABI = errors.Join(vaultABIErr, factoryABIErr)
)

// FilterTopics returns a fresh, sorted, deduplicated union of event signatures.
// Callers must also filter by trusted emitter addresses and contract kind.
func FilterTopics() []common.Hash {
	seen := make(map[common.Hash]bool)
	for _, contract := range []abi.ABI{vaultABI, factoryABI} {
		for _, event := range contract.Events {
			seen[event.ID] = true
		}
	}
	out := make([]common.Hash, 0, len(seen))
	for topic := range seen {
		out = append(out, topic)
	}
	sort.Slice(out, func(i, j int) bool { return bytes.Compare(out[i][:], out[j][:]) < 0 })
	return out
}

// UnpackVaultLog decodes vault events. The caller attaches events.Event metadata.
// Unknown signatures return (nil, nil); missing topics or malformed known logs fail.
func UnpackVaultLog(log types.Log) (any, error) { return unpackLog(vaultABI, log) }

// UnpackFactoryLog decodes factory events, with the same contract as UnpackVaultLog.
func UnpackFactoryLog(log types.Log) (any, error) { return unpackLog(factoryABI, log) }

func unpackLog(contract abi.ABI, log types.Log) (any, error) {
	if ErrABI != nil {
		return nil, ErrABI
	}
	if len(log.Topics) == 0 {
		return nil, errors.New("yearn: missing event signature")
	}
	event, err := contract.EventByID(log.Topics[0])
	if err != nil {
		return nil, nil
	}
	values, err := unpackEvent(*event, log)
	if err != nil {
		return nil, fmt.Errorf("yearn %s: %w", event.Name, err)
	}
	return eventValue(event.Name, values), nil
}

// canonicalUnpack rejects trailing bytes, noncanonical offsets, dirty address
// padding and integer overflow that ABI unpacking alone can silently accept.
func canonicalUnpack(args abi.Arguments, data []byte) ([]any, error) {
	values, err := args.Unpack(data)
	if err != nil {
		return nil, err
	}
	encoded, err := args.Pack(values...)
	if err != nil {
		return nil, err
	}
	if !bytes.Equal(encoded, data) {
		return nil, errors.New("noncanonical ABI encoding")
	}
	return values, nil
}

func unpackEvent(event abi.Event, log types.Log) ([]any, error) {
	dataArgs := event.Inputs.NonIndexed()
	wantTopics := 1 + len(event.Inputs) - len(dataArgs)
	if len(log.Topics) != wantTopics {
		return nil, fmt.Errorf("got %d topics, want %d", len(log.Topics), wantTopics)
	}
	dataValues, err := canonicalUnpack(dataArgs, log.Data)
	if err != nil {
		return nil, err
	}
	values := make([]any, len(event.Inputs))
	topicIndex, dataIndex := 1, 0
	for i, input := range event.Inputs {
		if input.Indexed {
			// All indexed types in the pinned sources are static single words.
			args := abi.Arguments{{Type: input.Type}}
			decoded, err := canonicalUnpack(args, log.Topics[topicIndex][:])
			if err != nil {
				return nil, fmt.Errorf("indexed %s: %w", input.Name, err)
			}
			values[i] = decoded[0]
			topicIndex++
		} else {
			values[i] = dataValues[dataIndex]
			dataIndex++
		}
	}
	if event.Name == "UpdateDefaultQueue" && len(values[0].([]common.Address)) > 10 {
		return nil, errors.New("default queue exceeds Vyper MAX_QUEUE (10)")
	}
	return values, nil
}
