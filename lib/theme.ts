// -----------------------------------------------------------------------------
// Florin — theme config.
//
// Light palette and fonts. Adaptive dark semantic tokens live in app/globals.css.
// Light defaults are emitted on <html> under --light-* names so they cannot
// override the stylesheet's prefers-color-scheme rules.
//
// Palette — Superposition brand. These four are the ONLY colours in the app;
// every token below is one of them, or one of them at reduced alpha for
// hierarchy.
//   Black      #1E1E1E  rgb(30,30,30)     text, rules, reverse blocks
//   White      #EEEEEE  rgb(238,238,238)  paper
//   Phthalo     #0F3D2E  rgb(15,61,46)     brand ink
//   Phthalo pale #DCEBE2 rgb(220,235,226)  brand surface
//
// Contrast: black on white 14.4  |  Phthalo on pale 9.9 (AAA)
//           black on pale 13.5   |  Phthalo on white 10.5
// -----------------------------------------------------------------------------

export interface Theme {
  // palette
  paradiso: string;
  shamrock: string;
  flax: string;
  roseBud: string;
  // typography
  sans: string; // sans stack — body / UI
  mono: string; // numbers / code
  // derived semantic tokens
  ink: string; // body text (dark)
  paper: string; // page / surface background (warm)
  gray1: string;
  gray2: string;
  gray3: string;
  gray4: string;
  line: string; // 1px rule / border
  lineSoft: string;
  gridDot: string;
  accent: string; // secondary accent text (labels, kickers)
  tintSoft: string; // soft surface highlight (yellow)
  tintWarm: string; // warm surface highlight (coral)
  strong: string; // reverse / filled elements (buttons, banner, stat)
  strongFg: string; // text on strong
}

// ---------------------------------------------------------------------------
// Edit me. Swap values, tweak, rebuild (`npm run dev` or `npm run build`).
// ---------------------------------------------------------------------------
export const THEME: Theme = {
  // raw palette — the four Superposition brand colours
  paradiso: '#1e1e1e',
  shamrock: '#0f3d2e',
  flax: '#dcebe2',
  roseBud: '#dcebe2',

  // PP Neue Montreal for display/UI (self-hosted, see app/globals.css),
  // mono kept for protocol values
  sans:
    '"PP Neue Montreal", Arial, "Helvetica Neue", Helvetica, ui-sans-serif, system-ui, sans-serif',
  mono:
    '"SF Mono", "IBM Plex Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',

  // derived semantic tokens — black at reduced alpha carries text hierarchy,
  // off-white at reduced alpha does the same on reverse blocks
  ink: '#1e1e1e',
  paper: '#eeeeee',
  gray1: 'rgba(30, 30, 30, 0.86)',
  gray2: 'rgba(30, 30, 30, 0.64)',
  gray3: 'rgba(30, 30, 30, 0.5)',
  gray4: 'rgba(238, 238, 238, 0.62)', // muted, used on dark only
  line: '#1e1e1e',
  lineSoft: 'rgba(30, 30, 30, 0.16)',
  gridDot: 'transparent',
  // The brand pair is reserved for the landing page and the app's own
  // surfaces, so the shared accent / tint tokens stay neutral
  accent: '#1e1e1e',
  tintSoft: '#eeeeee',
  tintWarm: '#eeeeee',
  strong: '#1e1e1e',
  strongFg: '#eeeeee',
};

// Emit light defaults and fonts for inline application on <html>.
export function themeVars(t: Theme = THEME): Record<string, string> {
  const vars = {
    '--paradiso': t.paradiso,
    '--shamrock': t.shamrock,
    '--flax': t.flax,
    '--rose-bud': t.roseBud,
    '--ink': t.ink,
    '--paper': t.paper,
    '--gray-1': t.gray1,
    '--gray-2': t.gray2,
    '--gray-3': t.gray3,
    '--gray-4': t.gray4,
    '--line': t.line,
    '--line-soft': t.lineSoft,
    '--grid-dot': t.gridDot,
    '--accent': t.accent,
    '--tint-soft': t.tintSoft,
    '--tint-warm': t.tintWarm,
    '--strong': t.strong,
    '--strong-fg': t.strongFg,
    '--sans': t.sans,
    '--mono': t.mono,
  };
  // Light defaults must not inline-override the adaptive semantic CSS tokens.
  return Object.fromEntries(Object.entries(vars).map(([key, value]) => [
    key === '--sans' || key === '--mono' ? key : key.replace('--', '--light-'), value,
  ]));
}