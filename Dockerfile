FROM golang:1.26-alpine AS build

WORKDIR /usr/src/florin.so

COPY go.mod ./

RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go build -o graph ./cmd/graphql
RUN CGO_ENABLED=0 go build -o ingestor ./cmd/ingestor.ethereum

FROM alpine:3.20

COPY --from=build /usr/src/florin.so/graph /bin/graph
COPY --from=build /usr/src/florin.so/ingestor /bin/ingestor
