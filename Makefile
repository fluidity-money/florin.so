BIN := cmd/ingestor.ethereum/ingestor.ethereum
CMDLET := ingestor.ethereum

.PHONY: build test run clean

build:
	CGO_ENABLED=0 go build -o $(BIN) ./cmd/ingestor.ethereum

test:
	go test ./...

vet:
	go vet ./...

run: build
	./$(BIN)

clean:
	rm -f $(BIN)