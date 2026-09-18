# Florin

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
