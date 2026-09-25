import { NextResponse, type NextRequest } from 'next/server';
import { BETA_COOKIE, tokenIsValid } from './lib/beta-gate';
import { gatePage } from './lib/beta-gate-page';

// Beta gate. Every request that is not already carrying a valid cookie gets
// the gate page instead of the app, including API routes: a visitor without
// the password sees one document, one font and one logo, and nothing else.
//
// This runs on Vercel's edge before any page renders, so the password lives in
// an environment variable and never enters a client bundle. That is the whole
// reason it is here rather than in a React component: a client-side check
// would have to ship the thing it is checking against.

// The gate's own assets and the endpoint that clears it. These are a brand
// mark, the tab icons and two fonts; serving them to a locked-out visitor
// gives nothing away, and gating them left the gate page with no favicon.
const PUBLIC_PATHS = new Set([
  '/api/gate',
  '/florin.svg',
  '/favicon.ico',
  '/icon.svg',
  '/apple-icon.png',
]);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith('/fonts/');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const password = process.env.BETA_PASSWORD;

  // Unset in development means "no gate", so a fresh clone runs without
  // ceremony. Unset in production means the gate is closed, not open: a deploy
  // that forgot the variable should be conspicuously locked rather than
  // silently public, which is the failure that actually costs something.
  if (!password) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse(gatePage({ next: '/', configured: false }), {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const token = req.cookies.get(BETA_COOKIE)?.value;
  if (token && (await tokenIsValid(token, password))) return NextResponse.next();

  // `?beta=denied` is set by the API route when a password is rejected; it is
  // how the gate shows an error without needing script or session state.
  const denied = req.nextUrl.searchParams.get('beta') === 'denied';

  // Send the visitor back where they were aiming once they are through.
  const target = new URL(req.nextUrl.toString());
  target.searchParams.delete('beta');
  const next = `${target.pathname}${target.search}`;

  return new NextResponse(gatePage({ next, denied }), {
    status: 401,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Never let a CDN or browser cache the locked page, or the unlocked one
      // in its place.
      'cache-control': 'no-store, must-revalidate',
    },
  });
}

export const config = {
  // Everything except Next's own build output. Those are hashed asset URLs
  // that reveal nothing on their own, and excluding them keeps the gate from
  // running on every chunk request.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
