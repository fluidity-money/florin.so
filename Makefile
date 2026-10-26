
PREFIX ?= /usr/local
SYSTEMD_DIR ?= /usr/lib/systemd/system

.PHONY: build cli test run clean

.DELETE_ON_ERROR:

FILES_GO := $(shell find cmd lib go.mod go.sum -type f)

build: cli

CLIS := ingestor graphql

cli: ${CLIS}

ingestor: ${FILES_GO} $(shell find cmd/ingestor -type f)
	@CGO_ENABLED=0 go build -o ingestor ./cmd/ingestor

graphql: ${FILES_GO} $(shell find cmd/graphql -type f)
	@CGO_ENABLED=0 go build -o graphql ./cmd/graphql

install: cli
	@mkdir -p ${DESTDIR}${PREFIX}/bin
	@install -m755 ${CLIS} ${DESTDIR}${PREFIX}/bin/
	@chmod +x ${DESTDIR}${PREFIX}/bin/${CLIS}
	@install -m644 ${UNITS} ${DESTDIR}${SYSTEMD_DIR}/

clean:
	@rm -f graphql ingestor
