import { NextResponse, type NextRequest } from 'next/server';
import { BETA_COOKIE, cookieOptions, mintToken, passwordMatches } from '../../../lib/beta-gate';

// Password submission target for the beta gate. Takes a form post, not JSON,
// so the gate page needs no JavaScript.

// Only ever bounce back to a path on this site. Without this check the `next`
// field is an open redirect: anyone could send a florin.so/... link that lands
// the visitor somewhere else the moment they type the password. A value must
// start with a single slash — `//evil.com` and `https://evil.com` are both
// rejected, as is anything with a backslash, which some clients normalise to
// a forward slash.
function safeNext(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

export async function POST(req: NextRequest) {
  const password = process.env.BETA_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: 'gate not configured' }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected a form post' }, { status: 400 });
  }

  const next = safeNext(form.get('next'));
  const submitted = form.get('password');
  const ok = typeof submitted === 'string' && (await passwordMatches(submitted, password));

  const dest = new URL(next, req.nextUrl.origin);
  if (!ok) dest.searchParams.set('beta', 'denied');

  // 303 so the browser follows with GET rather than re-posting the password.
  const res = NextResponse.redirect(dest, 303);
  res.headers.set('cache-control', 'no-store');

  if (ok) {
    // Behind Vercel's proxy the inbound connection is http, so the forwarded
    // header is what says whether the browser is on https.
    const proto =
      req.headers.get('x-forwarded-proto')?.split(',')[0].trim() ??
      req.nextUrl.protocol.replace(':', '');

    res.cookies.set(
      BETA_COOKIE,
      await mintToken(password),
      cookieOptions(proto === 'https'),
    );
  }

  return res;
}
