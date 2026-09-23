//go:generate go tool gqlgen generate

package main

import (
	"database/sql"
	"log"
	"net"
	"net/http"
	"os"

	_ "github.com/lib/pq"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/fluidity-money/florin.so/cmd/graphql/gen"
	"github.com/vektah/gqlparser/v2/ast"
)

// HttpUnixSocket that we listen on using a socket.
const HttpUnixSocket = "/run/florin.so/http.sock"

// EnvTimescaleUri to use as the database for private key loading
// and authentication key loading.
const EnvTimescaleUri = "SPN_TIMESCALE"

func main() {
	db, err := sql.Open("postgres", os.Getenv(EnvTimescaleUri))
	if err != nil {
		log.Fatalf("connect postgres: %v", err)
	}
	defer db.Close()
	srv := handler.New(gen.NewExecutableSchema(gen.Config{
		Resolvers: &gen.Resolver{
			FeatureFakeData: true,
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
	http.Handle("/", srv)
	_ = os.Remove(HttpUnixSocket)
	l, err := net.Listen("unix", HttpUnixSocket)
	if err != nil {
		log.Fatal(err)
	}
	defer l.Close()
	panic(http.Serve(l, nil))
}
