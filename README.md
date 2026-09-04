# florin

Liquity-style stablecoin protocol for SPY. Mint **FUSD** by borrowing against
**SPY** collateral. This is a **demo build**: the wallet is real (Reown AppKit
+ wagmi), and every onchain read / transaction is **mocked** with fake constants.

## Tech stack

- Next.js 15 (App Router) + TypeScript
- Reown AppKit (v1.8) + wagmi v2 + viem — real wallet connect
- @tanstack/react-query — data layer (future chain reads)
- Black & white, blueprint-grid aesthetic

## Screens (routes)

| route        | screen                                |
| ------------ | ------------------------------------- |
| `/`          | Home — protocol stats + "no positions opened" empty state |
| `/open`      | Open position — deposit SPY, borrow/mint FUSD |
| `/position`  | Manage — adjust / close a live (mocked) Trove |
| `/stability` | Stability pool — deposit FUSD, earn yield |

## Running

```bash
npm install
npm run dev        # http://localhost:3000
```

## Wallet mode

- **Mock** (default): connect button sets a fixed demo address. Everything works
  offline.
- **Real**: set a Reown Cloud project id to enable the full AppKit wallet modal.

```bash
cp .env.example .env.local
# edit .env.local -> NEXT_PUBLIC_REOWN_PROJECT_ID=<your id from cloud.reown.com>
```

## Where the mocking lives

All fake data is centralized in `lib/mockData.ts` — swap those constants for
real wagmi/AppKit reads later without touching the UI. The only real code path
is the wallet in `components/wallet/`.

> Clear the `.npmcache` directory under this repo if you ever copies it verbatim,
> and note the demo address in `components/wallet/wallet.tsx`.