package events

import (
	sqlDriver "database/sql/driver"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"

	ethCommon "github.com/ethereum/go-ethereum/common"
)

type (
	Address string
	Number  struct {
		i *big.Int
	}
)

// Event is the common database envelope attached to every decoded chain event.
type Event struct {
	CreatedBy       time.Time `json:"created_by"`
	BlockHash       string    `json:"block_hash"`
	TransactionHash string    `json:"transaction_hash"`
	BlockNumber     uint64    `json:"block_number"`
	EmitterAddr     string    `json:"emitter_addr"`
}

func AddressFromString(s string) Address {
	return Address(strings.ToLower(s))
}

func AddressFromCommon(a ethCommon.Address) Address {
	return AddressFromString(a.Hex())
}

func (a Address) String() string {
	return strings.ToLower(string(a))
}

func (a Address) Value() (sqlDriver.Value, error) {
	return a.String(), nil
}

func (a Address) MarshalJSON() ([]byte, error) {
	return json.Marshal(a.String())
}

func (a *Address) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	*a = AddressFromString(s)
	return nil
}

func (a *Address) Scan(v any) error {
	var s string
	switch v := v.(type) {
	case string:
		s = v
	case []byte:
		s = string(v)
	default:
		return fmt.Errorf("scan address from %T", v)
	}
	if !ethCommon.IsHexAddress(s) {
		return fmt.Errorf("invalid address: %q", s)
	}
	*a = AddressFromString(s)
	return nil
}

func NumberFromBig(x *big.Int) Number {
	if x == nil {
		x = new(big.Int)
	}
	return Number{i: new(big.Int).Set(x)}
}

func NumberFromString(s string) (*Number, error) {
	i, ok := new(big.Int).SetString(s, 10)
	if !ok {
		return nil, fmt.Errorf("not number: %q", s)
	}
	n := NumberFromBig(i)
	return &n, nil
}

func (n Number) String() string {
	if n.i == nil {
		return "0"
	}
	return n.i.String()
}

func (n Number) Big() *big.Int {
	if n.i == nil {
		return new(big.Int)
	}
	return new(big.Int).Set(n.i)
}

func (n Number) Value() (sqlDriver.Value, error) {
	return n.String(), nil
}

func (n Number) MarshalJSON() ([]byte, error) {
	return json.Marshal(n.String())
}

func (n *Number) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	x, err := NumberFromString(s)
	if err != nil {
		return err
	}
	*n = *x
	return nil
}

func (n *Number) Scan(v any) error {
	var s string
	switch v := v.(type) {
	case string:
		s = v
	case []byte:
		s = string(v)
	case int64:
		s = fmt.Sprint(v)
	default:
		return fmt.Errorf("scan number from %T", v)
	}
	x, err := NumberFromString(s)
	if err != nil {
		return err
	}
	*n = *x
	return nil
}
