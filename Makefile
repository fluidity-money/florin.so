
.PHONY: build test run clean

.DELETE_ON_ERROR:

FILES_GO := $(shell find cmd lib go.mod go.sum -type f)

build: ingestor graphql

ingestor: ${FILES_GO} $(shell find cmd/ingestor -type f)
	@CGO_ENABLED=0 go build -o ingestor ./cmd/ingestor

graphql: ${FILES_GO} $(shell find cmd/graphql -type f)
	@CGO_ENABLED=0 go build -o graphql ./cmd/graphql

clean:
	@rm -f graphql ingestor
