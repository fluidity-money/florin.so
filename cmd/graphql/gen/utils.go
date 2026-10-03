package gen

import (
	"database/sql"
	"encoding/hex"
	"fmt"
	"log/slog"
	"math"
	"math/big"
	"math/rand"
	"strings"
	"time"

	acc_convertor "github.com/fluidity-money/accounts.superposition.so/lib/convertor"
	acc_types "github.com/fluidity-money/accounts.superposition.so/lib/types"

	"github.com/fluidity-money/superposition-assets"

	"github.com/fluidity-money/florin.so/cmd/graphql/gen/model"
)

func createAccountToFreshBackwardsGraph(
	pubKey [32]byte,
	createAccount model.CreateAccount,
) (*acc_types.FreshBackwards, error) {
	eoa, err := strToAddr(createAccount.EoaAddr)
	if err != nil {
		return nil, fmt.Errorf("eoa: %v", err)
	}
	// TODO: authority = &AuthorityAddr
	if createAccount.SigV < 0 || createAccount.SigV > math.MaxUint8 {
		return nil, fmt.Errorf("v exceeds")
	}
	r, err := strToBytes32(createAccount.SigR)
	if err != nil {
		return nil, fmt.Errorf("r: %v", err)
	}
	s, err := strToBytes32(createAccount.SigS)
	if err != nil {
		return nil, fmt.Errorf("s: %v", err)
	}
	return acc_convertor.CreateAccountToFreshBackwards(
		pubKey,
		eoa,
		uint8(createAccount.SigV),
		r,
		s,
		// TODO: set the authority here
		nil,
	), nil
}

func newPermitGraph(
	asset superposition_assets.Asset,
	deadline uint64,
	permitV int32,
	permitR, permitS string,
) (*acc_types.Permit, error) {
	if permitV < 0 || permitV > math.MaxUint8 {
		return nil, fmt.Errorf("v exceeds")
	}
	r, err := strToBytes32(permitR)
	if err != nil {
		return nil, fmt.Errorf("permit r: %v", err)
	}
	s, err := strToBytes32(permitS)
	if err != nil {
		return nil, fmt.Errorf("permit s: %v", err)
	}
	return acc_convertor.NewPermit(
		asset,
		deadline,
		uint8(permitV),
		r,
		s,
	), nil
}

func strToBytes32(s string) ([32]byte, error) {
	var b [32]byte
	i, err := hex.Decode(b[:], []byte(strings.TrimPrefix(s, "0x")))
	if err != nil {
		return b, fmt.Errorf("decode str: %v", err)
	}
	if i != 32 {
		return b, fmt.Errorf("decode str len: %v", i)
	}
	return b, nil
}

func graphAssetToAsset(x model.Asset) *superposition_assets.Asset {
	switch x {
	case "USDG":
		x := superposition_assets.AssetUsdg
		return &x
	case "SPY":
		x := superposition_assets.AssetSpy
		return &x
	}
	panic("bad asset")
}

func pickMsTs() (b [6]byte) {
	u := new(big.Int).SetInt64(time.Now().UnixMilli())
	copy(b[:], u.Bytes())
	return
}

func pickMsTsBig(lag int) (b [16]byte) {
	t := time.Now().Add(time.Millisecond * time.Duration(lag))
	u := new(big.Int).SetInt64(t.UnixMilli())
	copy(b[:], u.Bytes())
	return
}

func bigToBytes32(x *big.Int) (b [32]byte, err error) {
	y := x.Bytes()
	if len(y) > 32 {
		return b, fmt.Errorf("int too big")
	}
	copy(b[:], y)
	return
}

func bigFromStr(x string) (*big.Int, bool) {
	y, ok := new(big.Int).SetString(x, 10)
	if !ok {
		return nil, false
	}
	if len(y.Bytes()) > 32 {
		return nil, false
	}
	return y, false
}

func makeSecret() (secret []byte) {
	secret = make([]byte, 32)
	if n, err := rand.Read(secret); n != 32 || err != nil {
		panic(fmt.Errorf("error with randomness: %v", err))
	}
	return
}

func trackTx(db *sql.DB, eoaS, txHash string, gasLimit uint64, desc string) {
	_, err := db.Exec(`
INSERT INTO accounts_executed_transactions_2 (
	eoa_addr,
	transaction_hash,
	gas_limit,
	desc_
)
VALUES ($1, $2, $3, $4)`,
		eoaS,
		txHash,
		gasLimit,
		desc,
	)
	if err != nil {
		slog.Error("error tracking executed transactions", "err", err)
		// We'll ignore this and not propagate up to the user this error.
	}
}

func strToAddr(s string) ([20]byte, error) {
	var b [20]byte
	if s == "" {
		return b, nil
	}
	i, err := hex.Decode(b[:], []byte(strings.TrimPrefix(s, "0x")))
	if err != nil {
		return b, fmt.Errorf("decode str: %v", err)
	}
	if i != 20 {
		return b, fmt.Errorf("decode str len: %v", i)
	}
	return b, nil
}
