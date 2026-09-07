// -----------------------------------------------------------------------------
// Florin — theme config.
//
// THIS IS THE SINGLE SOURCE OF TRUTH FOR the visual theme (colors + fonts).
// Edit values here, rebuild, and the whole app re-skins. Used to A/B palettes
// quickly — the tokens below are emitted as CSS custom properties on <body>
// from app/layout.tsx, and the stylesheet references them by name.
//
// Palette (Paradiso / Shamrock / Flax / Rose Bud):
//   Paradiso #3A8D90  rgb(58,141,144)   teal   — primary, lines, strong fills
//   Shamrock #34C5AD  rgb(52,197,173)   aqua   — secondary accent text
//   Flax     #E9E07F  rgb(233,224,127)  yellow — soft surface tone
//   Rose Bud #F7B295  rgb(247,178,149)  coral  — warm highlight tone
// -----------------------------------------------------------------------------

export interface Theme {
  // palette
  paradiso: string;
  shamrock: string;
  flax: string;
  roseBud: string;
  // typography
  sans: string; // serif stack — body / UI
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
  // raw palette — warm/cool editorial contrast derived from the Florin mark
  paradiso: '#171717',
  shamrock: '#e8ad24',
  flax: '#a9d4df',
  roseBud: '#f0c7ba',

  // neutral grotesk for display/UI, mono kept for protocol values
  sans: 'Arial, "Helvetica Neue", Helvetica, ui-sans-serif, system-ui, sans-serif',
  mono:
    '"SF Mono", "IBM Plex Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',

  // derived semantic tokens
  ink: '#111111',
  paper: '#f7f7f3',
  gray1: '#242424',
  gray2: '#555550',
  gray3: '#777771',
  gray4: '#c9c9c1',
  line: '#171717',
  lineSoft: '#d9d9d1',
  gridDot: 'transparent',
  accent: '#b97800',
  tintSoft: '#a9d4df',
  tintWarm: '#f0c7ba',
  strong: '#171717',
  strongFg: '#f7f7f3',
};

// Emit as CSS custom properties for inline application on <body>.
export function themeVars(t: Theme = THEME): Record<string, string> {
  return {
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
}