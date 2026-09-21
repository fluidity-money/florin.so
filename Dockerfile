FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /ingest ./cmd/ingestor.ethereum

FROM alpine:3.20
COPY --from=build /ingest /ingest
ENTRYPOINT ["/ingest"]