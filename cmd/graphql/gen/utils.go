package gen

import (
	"time"
	"math/big"

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

	var authority *types.ArgsAuthorityAddr
	if a := createAccount.Authority; a != nil {
		x, err := strToAddr(*a)
		if err != nil {
			return nil, fmt.Errorf("authority: %v", err)
		}
		v := types.ArgsAuthorityAddr(x)
		authority = &v
	}

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

	return CreateAccountToFreshBackwards(
		pubKey,
		eoa,
		uint8(createAccount.SigV),
		r,
		s,
		authority,
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
	return NewPermit(
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
		return &superposition_assets.AssetUsdg
	case "SPY":
		return &superposition_assets.AssetSpy
	}
}

func pickMsTs() (b [6]byte) {
	u := new(big.Int).SetInt64(time.Now().Unix())
	copy(b[:], u.Bytes())
	return
}

func bigToBytes32(x *big.Int) (b [32]byte, err error) {
	y := x.Bytes()
	if y.Len() > 32 {
		return b, fmt.Errorf("int too big")
	}
	copy(b[:], y)
	return
}