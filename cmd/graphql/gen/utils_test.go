package gen

import (
	"math/big"
	"testing"
)

func TestBigFromStrAcceptsUint256(t *testing.T) {
	got, ok := bigFromStr("258")
	if !ok {
		t.Fatal("expected valid uint256")
	}
	if got.Cmp(big.NewInt(258)) != 0 {
		t.Fatalf("got %v, want 258", got)
	}
}

func TestBigFromStrRejectsNegativeUint256(t *testing.T) {
	if _, ok := bigFromStr("-1"); ok {
		t.Fatal("expected negative uint256 to be rejected")
	}
}

func TestBigToBytes32UsesBigEndianUint256Encoding(t *testing.T) {
	got, err := bigToBytes32(big.NewInt(258))
	if err != nil {
		t.Fatalf("bigToBytes32: %v", err)
	}
	var want [32]byte
	want[30] = 1
	want[31] = 2
	if got != want {
		t.Fatalf("got %x, want %x", got, want)
	}
}

func TestIsDryrun(t *testing.T) {
	falseValue := false
	trueValue := true
	for _, test := range []struct {
		name  string
		input *bool
		want  bool
	}{
		{name: "unset", input: nil, want: false},
		{name: "false", input: &falseValue, want: false},
		{name: "true", input: &trueValue, want: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := isDryrun(test.input); got != test.want {
				t.Fatalf("got %v, want %v", got, test.want)
			}
		})
	}
}
