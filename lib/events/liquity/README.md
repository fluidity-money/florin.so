# Liquity events

This package contains the event-only ABIs and Go decoders used by the Ethereum
log ingestor.

The event definitions were copied from Liquity's `bold` repository at commit
`c8a5a4ee2e9dc024905856b6698a77d849c68c7e`, including the generated frontend
ABIs and the Solidity definitions for events not exposed by the frontend.

The ABI is split because ERC-20 BOLD and ERC-721 Trove NFTs both define
`Approval` and `Transfer` with the same canonical signatures. `UnpackLog`
distinguishes them by indexed-topic count. The ingestor also restricts log
queries and dispatch to the contract addresses supplied through the
comma-separated `SPN_LIQUITY_ADDRS` environment variable; this is required so
ordinary ERC-20 events elsewhere on the chain are not mistaken for BOLD events.
