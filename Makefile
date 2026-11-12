
PREFIX ?= /usr/local
SYSTEMD_DIR ?= /usr/lib/systemd/system

.PHONY: build cli test run clean

.DELETE_ON_ERROR:

FILES_GO := $(shell find cmd lib go.mod go.sum -type f)

build: cli

CLIS := florin-ingestor florin-graph florin-yield-cron

UNITS := florin-graph.service florin-graph.socket florin-ingestor.service

cli: ${CLIS}

florin-ingestor: ${FILES_GO} $(shell find cmd/ingestor -type f)
	@go build -o florin-ingestor ./cmd/ingestor

florin-yield-cron: ${FILES_GO}
	@go build -o florin-yield-cron ./cmd/yield-cron

florin-graph: ${FILES_GO}
	@go build -o florin-graph ./cmd/graphql

install: cli
	@mkdir -p ${DESTDIR}${PREFIX}/bin
	@install -m755 ${CLIS} ${DESTDIR}${PREFIX}/bin/
	@chmod +x ${DESTDIR}${PREFIX}/bin/${CLIS}
	@install -m644 ${UNITS} ${DESTDIR}${SYSTEMD_DIR}/

clean:
	@rm -f graphql ingestor
