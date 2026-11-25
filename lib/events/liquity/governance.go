// Copyright 2026 Fluid Assets Limited BVI. All rights reserved. Use of this
// source code is governed by a BUSL license that can be found in the
// LICENSE file.

package liquity

import (
	_ "embed"
	"fmt"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/fluidity-money/florin.so/lib/types/events"
)

//go:embed governance-abi.json
var governanceABIJSON string

var (
	governanceABI, governanceABIErr = abi.JSON(strings.NewReader(governanceABIJSON))
	TopicOperationQueued            = eventID(governanceABI, "OperationQueued")
	TopicOperationExecuted          = eventID(governanceABI, "OperationExecuted")
	TopicOperationCancelled         = eventID(governanceABI, "OperationCancelled")
	TopicStorageWiped               = eventID(governanceABI, "StorageWiped")
	TopicUpgraded                   = eventID(governanceABI, "Upgraded")
)

// Governance events have only static arguments. Reject trailing data as well as
// short data: the ABI unpacker alone permits trailing bytes (even for no inputs).
func unpackGovernanceEvent(name string, topics []common.Hash, data []byte) ([]any, error) {
	if ErrABI != nil {
		return nil, ErrABI
	}
	event := governanceABI.Events[name]
	if want := 32 * len(event.Inputs.NonIndexed()); len(data) != want {
		return nil, fmt.Errorf("%s: got %d data bytes, want %d", name, len(data), want)
	}
	return unpackEvent(event, topics, data)
}

type OperationQueued struct {
	events.Event
	Digest string `json:"digest"`
}

func (OperationQueued) TableName() string { return "liquity_events_operation_queued" }

func UnpackOperationQueued(topics []common.Hash, data []byte) (*OperationQueued, error) {
	values, err := unpackGovernanceEvent("OperationQueued", topics, data)
	if err != nil {
		return nil, err
	}
	return &OperationQueued{Digest: common.Hash(values[0].([32]byte)).Hex()}, nil
}

type OperationExecuted struct {
	events.Event
	Digest string `json:"digest"`
}

func (OperationExecuted) TableName() string { return "liquity_events_operation_executed" }

func UnpackOperationExecuted(topics []common.Hash, data []byte) (*OperationExecuted, error) {
	values, err := unpackGovernanceEvent("OperationExecuted", topics, data)
	if err != nil {
		return nil, err
	}
	return &OperationExecuted{Digest: common.Hash(values[0].([32]byte)).Hex()}, nil
}

type OperationCancelled struct {
	events.Event
	Digest string `json:"digest"`
}

func (OperationCancelled) TableName() string { return "liquity_events_operation_cancelled" }

func UnpackOperationCancelled(topics []common.Hash, data []byte) (*OperationCancelled, error) {
	values, err := unpackGovernanceEvent("OperationCancelled", topics, data)
	if err != nil {
		return nil, err
	}
	return &OperationCancelled{Digest: common.Hash(values[0].([32]byte)).Hex()}, nil
}

type StorageWiped struct {
	events.Event
}

func (StorageWiped) TableName() string { return "liquity_events_storage_wiped" }

func UnpackStorageWiped(topics []common.Hash, data []byte) (*StorageWiped, error) {
	if _, err := unpackGovernanceEvent("StorageWiped", topics, data); err != nil {
		return nil, err
	}
	return &StorageWiped{}, nil
}

type Upgraded struct {
	events.Event
	Implementation events.Address `json:"implementation"`
}

func (Upgraded) TableName() string { return "liquity_events_upgraded" }

func UnpackUpgraded(topics []common.Hash, data []byte) (*Upgraded, error) {
	values, err := unpackGovernanceEvent("Upgraded", topics, data)
	if err != nil {
		return nil, err
	}
	return &Upgraded{Implementation: events.AddressFromCommon(values[0].(common.Address))}, nil
}
