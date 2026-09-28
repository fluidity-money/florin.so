# Florin

## Robinhood testnet borrowing

The `/open` flow talks directly to the canonical Bold Stylus deployment on
Robinhood Chain Testnet (chain ID `46630`). It reads the SPY balance, allowance,
oracle price and predicted upfront fee, obtains sorted-trove hints, approves the
exact SPY requirement, then calls `BorrowerOperations.openTrove`.

An injected browser wallet works without configuration. Set
`NEXT_PUBLIC_REOWN_PROJECT_ID` to enable the Reown/WalletConnect modal as well.
The connected wallet needs testnet ETH and testnet SPY. Opening a trove also
requires the protocol's separate `0.0375 SPY` gas-compensation deposit.

## Beta gate

The whole site sits behind a password while it is in beta. `middleware.ts`
checks every request at the edge and serves a logo-and-password page instead
of the app until a valid session cookie is present.

The password lives in `BETA_PASSWORD` and is only ever read on the server, so
it never reaches a client bundle. A correct submission gets an HttpOnly cookie
holding an expiry and an HMAC over it, signed with the password itself: the
cookie cannot be forged or extended, and changing the password invalidates
every session issued under the old one.

Local development:

```bash
cp .env.example .env.local   # then edit BETA_PASSWORD
```

With `BETA_PASSWORD` unset, development runs ungated and production fails
closed, so a deploy that forgets the variable is locked rather than silently
public.

Production: set `BETA_PASSWORD` in the Vercel project's environment variables
(Settings -> Environment Variables) and redeploy.

To lift the gate entirely, delete `middleware.ts`.

### What it is and is not

It keeps the site out of the hands of anyone who does not have the password,
and it is a real server-side check rather than a client-side one. It is not a
defence against someone the password was shared with, and there is no rate
limiting on guesses, so use a password long enough that guessing is not worth
attempting.
