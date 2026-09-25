// The gate page, returned directly by the middleware.
//
// Deliberately not a Next route. Rendering it here means an unauthenticated
// visitor is never served the app: no layout, no Providers, no wallet code, no
// application bundle at all, only this document plus the logo and one font.
// It also sidesteps the fact that the root layout always wraps every page, so
// a /gate route would arrive carrying the header nav and a Connect Wallet
// button, which is the opposite of a closed door.
//
// There is no JavaScript. It is a plain form post, so the gate works with
// scripts blocked and has no fetch/JSON path to get wrong.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export function gatePage({
  next,
  denied,
  configured = true,
}: {
  next: string;
  denied?: boolean;
  configured?: boolean;
}): string {
  const safeNext = escapeHtml(next);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Florin</title>
<style>
  @font-face {
    font-family: 'PP Neue Montreal';
    src: url('/fonts/ppneuemontreal-bold.woff2') format('woff2');
    font-weight: 700; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: 'PP Neue Montreal';
    src: url('/fonts/ppneuemontreal-book.woff2') format('woff2');
    font-weight: 400; font-style: normal; font-display: swap;
  }
  :root {
    --paper: #eeeeee;
    --ink: #1e1e1e;
    --biscay: #0f3d2e;
    --hawkes: #dcebe2;
    --bad: #b0483a;
    --gray-2: #5a5a5a;
  }
  * { box-sizing: border-box; }
  /* Flex, not grid with place-items:center. An auto-sized grid track takes
     its width from the item's max-content, and the item's width:100% then
     resolves against that track rather than the viewport -- so the one-line
     note made the column wider than the screen and pushed the whole card off
     to the right on a phone. A flex container is sized by the viewport, so
     max-width caps against something real. */
  html { height: 100%; }
  body {
    margin: 0;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: var(--paper);
    color: var(--ink);
    font-family: 'PP Neue Montreal', Arial, 'Helvetica Neue', Helvetica, ui-sans-serif, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .gate { width: 100%; max-width: 360px; text-align: center; }
  .gate__brand {
    display: inline-flex; align-items: center; gap: 12px;
    font-size: 30px; font-weight: 700; letter-spacing: -0.035em; line-height: 1;
    margin-bottom: 10px;
  }
  .gate__mark {
    display: block; width: 32px; height: 37px; background: currentColor;
    -webkit-mask: url('/florin.svg') center / contain no-repeat;
    mask: url('/florin.svg') center / contain no-repeat;
  }
  .gate__note {
    margin: 0 0 26px; font-size: 13px; font-weight: 400; color: var(--gray-2);
  }
  form { display: flex; flex-direction: column; gap: 10px; }
  .gate__input {
    width: 100%; padding: 14px 16px;
    border: 1px solid rgba(30,30,30,0.22); border-radius: 12px;
    background: #fff; color: var(--ink);
    font: inherit; font-size: 16px; font-weight: 400; /* 16px: iOS zooms below it */
    text-align: center; letter-spacing: 0.04em;
  }
  .gate__input::placeholder { color: #9a9a9a; letter-spacing: normal; }
  .gate__input:focus { outline: none; border-color: var(--biscay); }
  .gate__btn {
    padding: 14px 16px; border: 1px solid var(--biscay); border-radius: 12px;
    background: var(--biscay); color: var(--hawkes);
    font: inherit; font-size: 13px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
  }
  .gate__btn:hover { background: #0a2c20; }
  .gate__err {
    margin: 0; min-height: 18px; font-size: 13px; font-weight: 400; color: var(--bad);
  }
  @media (prefers-reduced-motion: no-preference) {
    .gate { animation: rise .28s ease-out both; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px); } }
  }
</style>
</head>
<body>
  <main class="gate">
    <span class="gate__brand"><span class="gate__mark" aria-hidden="true"></span>Florin</span>
    <p class="gate__note">${
      configured
        ? 'Private beta. Enter the password to continue.'
        : 'Private beta. The gate is not configured on this deployment.'
    }</p>
    ${
      configured
        ? `<form method="POST" action="/api/gate">
      <input type="hidden" name="next" value="${safeNext}">
      <label for="beta-password" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">Password</label>
      <input id="beta-password" class="gate__input" type="password" name="password"
             placeholder="Password" autocomplete="current-password"
             autofocus required>
      <button class="gate__btn" type="submit">Enter</button>
      <p class="gate__err" role="alert">${denied ? 'That password is not right.' : ''}</p>
    </form>`
        : `<p class="gate__err" role="alert">Set BETA_PASSWORD in the environment and redeploy.</p>`
    }
  </main>
</body>
</html>`;
}
