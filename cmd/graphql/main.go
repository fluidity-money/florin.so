//go:generate go tool gqlgen generate

package main

import (
	"encoding/json"
	"database/sql"
	"log"
	"net"
	"context"
	"strings"
	"log/slog"
	"math/big"
	"net/http"
	"os"
	"encoding/hex"

	"github.com/fluidity-money/florin.so/cmd/graphql/gen"

	_ "github.com/lib/pq"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/ethereum/go-ethereum/ethclient"
	ethCommon "github.com/ethereum/go-ethereum/common"
)

// HttpUnixSocket that we listen on using a socket.
const HttpUnixSocket = "/run/florin.so/http.sock"

const (
	// EnvTimescaleUri to use as the database for private key loading
	// and authentication key loading.
	EnvTimescaleUri = "SPN_TIMESCALE"

	// EnvFeatureFakeData if set to anything other than "", renders fake data.
	EnvFeatureFakeData = "SPN_FEATURE_FAKE_DATA"

	// EnvChainId to send transactions to.
	EnvChainId = "SPN_CHAIN_ID"

	// EnvGethAddr to connect to make requests to Superposition.
	EnvGethAddr = "SPN_GETH_URL"

	// EnvAccountsFactoryAddr to derive the addresses to send
	// transactions to when users ask to solve with mint, or to
	// create accounts with.
	EnvAccountsFactoryAddr = "SPN_ACCOUNTS_ADDR"

	// EnvAccPublicKey, set since we feed the Rust code the private key, and
	// it expects a differently sized key, so we can't derive the same key reliably here.
	EnvAccPublicKey = "SPN_ACCOUNTS_PUBLIC_KEY"

	// EnvAccPrivateKey to execute transactions on the behalf of users with.
	EnvAccPrivateKey = "SPN_ACCOUNTS_PRIVATE_KEY"

	// EnvSafetyRouter to use for the validation check on-chain
	// before calldata sending.
	EnvSafetyRouter = "SPN_SAFETY_ROUTER_ADDR"

	// EnvBorrowerOperations to interact with using the graph to create borrowing.
	EnvBorrowerOperations = "SPN_BORROWER_OPERATIONS"

	// EnvFaucet to use to get the WETH amounts for the borrow collateral from.
	EnvFaucet = "SPN_FAUCET_ADDR"

	// EnvWeth to use for sending the approval in the router steps.
	EnvWeth = "SPN_WETH_ADDR"
)

type middleware struct {
	srv http.Handler
	db *sql.DB
}

func (m middleware) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "*")
		w.Header().Set("Access-Control-Allow-Methods", "*")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("Access-Control-Expose-Headers", "*")
	}
	if r.Method == "OPTIONS" {
		w.WriteHeader(204)
		return
	}
	switch bearer := r.Header.Get("Authorization"); bearer {
	case "":
		m.srv.ServeHTTP(w, r)
	default:
		bearerS := strings.Split(bearer, ":")
		eoaPreferred_ := bearerS[0]
		if !ethCommon.IsHexAddress(eoaPreferred_) {
			slog.Error("not eoa address",
				"eoa", eoaPreferred_,
			)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		// Normalise with ethCommon's representation of addresses (which include
		// the 0x):
		eoaPreferred := strings.ToLower(ethCommon.HexToAddress(eoaPreferred_).String())
		_, err := hex.DecodeString(bearerS[1])
		if err != nil {
			slog.Error("error decoding bearer",
				"err", err,
				"bearer", bearerS,
			)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		secretX := strings.ToLower(bearerS[1])
		row := m.db.QueryRow(`
SELECT COUNT(1)
FROM accounts_secrets_2
WHERE eoa_addr = $1 AND secret = $2`,
			eoaPreferred,
			secretX,
		)
		var count int
		if err := row.Scan(&count); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			log.Fatalf("error scanning secrets, snowflake: %v: %v", "snowflake", err)
			writeUnauthorised(w)
			return
		}
		if count == 0 {
			w.WriteHeader(http.StatusUnauthorized)
			slog.Error("no rows found")
			writeUnauthorised(w)
			return
		}
		eoa := ethCommon.HexToAddress(eoaPreferred)
		m.srv.ServeHTTP(w, r.WithContext(context.WithValue(
			context.WithValue(
				r.Context(),
				"authed",
				true,
			),
			"eoa",
			eoa,
		)))
	}
}

func main() {
	db, err := sql.Open("postgres", os.Getenv(EnvTimescaleUri))
	if err != nil {
		log.Fatalf("connect postgres: %v", err)
	}
	defer db.Close()
	client, err := ethclient.Dial(os.Getenv(EnvGethAddr))
	if err != nil {
		log.Fatalf("connect geth: %v", err)
	}
	defer client.Close()
	chainId, ok := new(big.Int).SetString(os.Getenv(EnvChainId), 10)
	if !ok {
		log.Fatal("bad chain id")
	}
	accountsFactoryAddrS := os.Getenv(EnvAccountsFactoryAddr)
	addrAccountsFactory := ethCommon.HexToAddress(accountsFactoryAddrS)
	if _, err := hex.DecodeString(os.Getenv(EnvAccPrivateKey)); err != nil {
		log.Fatalf("accounts private key needs to be set: %v", err)
	}
	accPubKeyB, err := hex.DecodeString(os.Getenv(EnvAccPublicKey))
	if err != nil {
		log.Fatalf("accounts public key: %v", err)
	}
	var accPubKey [32]byte
	copy(accPubKey[:], accPubKeyB)
	addrBorrowOperationsS := os.Getenv(EnvBorrowerOperations)
	if !ethCommon.IsHexAddress(addrBorrowOperationsS) {
		log.Fatal("borrower operations address")
	}
	addrBorrowerOperations := ethCommon.HexToAddress(addrBorrowOperationsS)
	addrSafetyRouterS := os.Getenv(EnvSafetyRouter)
	if !ethCommon.IsHexAddress(addrSafetyRouterS) {
		log.Fatal("safety router address")
	}
	addrSafetyRouter := ethCommon.HexToAddress(addrSafetyRouterS)
	addrFaucetS := os.Getenv(EnvFaucet)
	if !ethCommon.IsHexAddress(addrFaucetS) {
		log.Fatal("faucet address")
	}
	addrFaucet := ethCommon.HexToAddress(addrFaucetS)
	addrWethS := os.Getenv(EnvWeth)
	if !ethCommon.IsHexAddress(addrWethS) {
		log.Fatal("weth address")
	}
	addrWeth := ethCommon.HexToAddress(addrWethS)
	srv := handler.New(gen.NewExecutableSchema(gen.Config{
		Resolvers: &gen.Resolver{
			FeatureFakeData:        os.Getenv(EnvFeatureFakeData) != "",
			Db:                     db,
			AccPubKey:              accPubKey,
			AddrBorrowerOperations: addrBorrowerOperations,
			AddrSafetyRouter:        addrSafetyRouter,
			AddrAccountsFactory:    addrAccountsFactory,
			AddrFaucet:             addrFaucet,
			AddrWeth:               addrWeth,
			Client:                 client,
			ChainId:                chainId,
		},
	}))
	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})
	srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))
	srv.Use(extension.Introspection{})
	srv.Use(extension.AutomaticPersistedQuery{
		Cache: lru.New[string](100),
	})
	http.Handle("/playground", playground.Handler("GraphQL playground", "/query"))
	http.Handle("/", middleware{
		srv,
		db,
	})
	_ = os.Remove(HttpUnixSocket)
	l, err := net.Listen("unix", HttpUnixSocket)
	if err != nil {
		log.Fatal(err)
	}
	defer l.Close()
	panic(http.Serve(l, nil))
}

func writeUnauthorised(w http.ResponseWriter) {
	_ = json.NewEncoder(w).Encode(struct {
		Error string `json:"error"`
	}{"unauthorised"})
}
