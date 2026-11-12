
PREFIX ?= /usr/local
SYSTEMD_DIR ?= /usr/lib/systemd/system

.PHONY: build cli test run clean

.DELETE_ON_ERROR:

FILES_GO := $(shell find cmd lib go.mod go.sum -type f)

build: cli

CLIS := florin-ingestor florin-graph florin-interest

UNITS := \
	florin-graph.service \
	florin-graph.socket \
	florin-ingestor.service \
	florin-interest@.service \
	florin-interest@.timer

cli: ${CLIS}

florin-ingestor: ${FILES_GO} $(shell find cmd/ingestor -type f)
	@go build -o florin-ingestor ./cmd/ingestor

florin-interest: ${FILES_GO}
	@go build -o florin-interest ./cmd/interest

florin-graph: ${FILES_GO}
	@go build -o florin-graph ./cmd/graphql

install: cli
	@mkdir -p ${DESTDIR}${PREFIX}/bin
	@install -m755 ${CLIS} ${DESTDIR}${PREFIX}/bin/
	@chmod +x ${DESTDIR}${PREFIX}/bin/${CLIS}
	@install -m644 ${UNITS} ${DESTDIR}${SYSTEMD_DIR}/

clean:
	@rm -f graphql ingestor
