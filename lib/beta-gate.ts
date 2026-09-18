// Shared crypto for the beta gate.
//
// Both callers must agree on this, and they run in different places: the
// middleware on Vercel's edge runtime, the API route in Node. Web Crypto is
// the only API both have, so everything here goes through crypto.subtle
// rather than node:crypto.
//
// The password itself never reaches the browser. The client sends a candidate
// to /api/gate; on a match the server returns an HttpOnly cookie holding an
// expiry and an HMAC over it. Nothing in the bundle can be read to recover the
// password, and nothing in the cookie can be edited to extend a session.

export const BETA_COOKIE = 'florin_beta';

// A beta gate people re-enter every week is a gate people share the password
// for in a group chat. Thirty days.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const enc = new TextEncoder();

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Constant time over equal-length hex. Every caller here compares digests, so
// the length is fixed and an early length exit leaks nothing.
function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Compare a submitted password against the configured one without branching on
// content. Hashing both first also normalises length, so a wrong guess of the
// wrong length costs the same as a wrong guess of the right length.
export async function passwordMatches(submitted: string, actual: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    hmacHex(actual, 'florin-beta-compare'),
    hmacHex(submitted, 'florin-beta-compare'),
  ]);
  return equalHex(a, b);
}

// The password doubles as the signing key, so rotating it invalidates every
// session that was issued under the old one. That is the behaviour you want
// from a beta gate: changing the password actually locks people out.
export async function mintToken(password: string): Promise<string> {
  const expiry = String(Date.now() + TTL_MS);
  return `${expiry}.${await hmacHex(password, expiry)}`;
}

export async function tokenIsValid(token: string, password: string): Promise<boolean> {
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expiry = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  return equalHex(sig, await hmacHex(password, expiry));
}

// `secure` follows the actual request scheme rather than NODE_ENV. Keying it
// on NODE_ENV looks equivalent but breaks `next start` over http://localhost:
// the cookie is issued with Secure, the browser then refuses to send it back
// over http, and the gate can never be unlocked in a local production build.
export function cookieOptions(isSecureRequest: boolean) {
  return {
    httpOnly: true, // no script, including ours, can read it
    secure: isSecureRequest,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(TTL_MS / 1000),
  };
}
