package gen

import (
	"fmt"
	"math/big"
	"strings"
)

var fixedPointScale = new(big.Rat).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil))

func parseNumber(value string) (*big.Rat, error) {
	n, ok := new(big.Rat).SetString(value)
	if !ok {
		return nil, fmt.Errorf("invalid database number %q", value)
	}
	return n, nil
}

func formatAmount(value string) (string, error) {
	n, err := parseNumber(value)
	if err != nil {
		return "", err
	}
	n.Quo(n, fixedPointScale)

	absolute := new(big.Rat).Abs(new(big.Rat).Set(n))
	suffix := ""
	decimals := 0
	switch {
	case absolute.Cmp(big.NewRat(999_500, 1)) >= 0:
		n.Quo(n, big.NewRat(1_000_000, 1))
		suffix = "M"
		decimals = 2
	case absolute.Cmp(big.NewRat(1_999, 2)) >= 0:
		n.Quo(n, big.NewRat(1_000, 1))
		suffix = "K"
		decimals = 2
	}
	return trimDecimal(n.FloatString(decimals)) + suffix, nil
}

func formatPercent(value string) (string, error) {
	n, err := parseNumber(value)
	if err != nil {
		return "", err
	}
	n.Quo(n, fixedPointScale)
	n.Mul(n, big.NewRat(100, 1))
	return trimDecimal(n.FloatString(2)) + "%", nil
}

func trimDecimal(value string) string {
	if !strings.Contains(value, ".") {
		return value
	}
	return strings.TrimRight(strings.TrimRight(value, "0"), ".")
}

func normalizeAddress(value string) (string, error) {
	if len(value) != 42 || value[:2] != "0x" {
		return "", fmt.Errorf("must be 0x followed by 40 hexadecimal characters")
	}
	for _, character := range value[2:] {
		if !((character >= '0' && character <= '9') ||
			(character >= 'a' && character <= 'f') ||
			(character >= 'A' && character <= 'F')) {
			return "", fmt.Errorf("must be 0x followed by 40 hexadecimal characters")
		}
	}
	return strings.ToLower(value), nil
}
