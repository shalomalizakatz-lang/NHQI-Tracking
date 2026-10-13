// Single source of truth for literal color values used anywhere that can't read
// a CSS custom property -- react-pdf's StyleSheet (a different render target),
// and plain JS that computes against a color (qColor, the contrast checker).
// src/index.css's `@theme` block mirrors a subset of these by hand; a comment in
// each file points at the other. Keep both in sync when a value changes here.
// Every pair a screen actually puts text or a functional boundary on is checked
// by `node scripts/check-contrast.mjs` against WCAG 2.2 AA (4.5:1 text, 3:1 large
// text/UI components). `border`/`borderSubtle` are decorative dividers only (row/
// card separation that's also conveyed by spacing and content, not the sole means
// of perceiving a boundary) and are intentionally exempt from the 3:1 non-text
// rule per WCAG 1.4.11's note on already-visible/decorative boundaries;
// `borderControl` is the one that must pass 3:1, for input/button/interactive
// element outlines where the boundary itself is load-bearing.
export const colors = {
  surface: "#ffffff",
  page: "#fafaf9",
  border: "#e2e8f0",
  borderSubtle: "#f0efed",
  borderControl: "#64748b",
  ink: "#0f172a",
  inkSecondary: "#475569",
  inkMuted: "#64748b",

  accent: "#0d9488",
  accentBg: "#f0fdfa",
  accentBorder: "#99f6e4",
  accentText: "#0f766e",

  amber: "#d97706",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  amberText: "#92400e",

  red: "#dc2626",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  redText: "#991b1b",

  green: "#15803d",
  greenBg: "#f0fdf4",

  neutral: "#64748b",
  neutralBg: "#f8fafc",
  neutralBorder: "#cbd5e1",
};

// Which status color each typed observation state renders with. "valid" has no
// status color of its own -- it's plain data, not a state that needs flagging.
// Always pair with text/an icon elsewhere; never rely on color alone.
export const OBSERVATION_STATE_COLOR = {
  valid: null,
  missing_input: "amber",
  stale_noncomparable: "amber",
  invalid_input: "red",
  unavailable_source: "neutral",
  suppressed_official: "neutral",
};

// Quintile 1 (best) -> 5 (worst), kept distinct from the generic status palette
// above since quintiles are a 5-step clinical scale, not an error/warning state.
// Each shade is deliberately darker than the "stock" Tailwind -600 swatch --
// qColor() (colors.js) hands these out as a bare text color on white/light
// surfaces in several places (e.g. PriorityList's "Q2 -> Q1" label), and the
// lighter -600 shades (lime/amber/orange) measured 3.0-3.6:1 there, short of
// WCAG's 4.5:1 for normal text -- confirmed by an axe-core sweep, not assumed.
export const quintileScale = {
  1: colors.green, // green-700, 5.02:1 on white
  2: "#4d7c0f", // lime-700, 4.99:1 on white
  3: colors.amberText, // amber-800, 6.84:1 on white
  4: "#c2410c", // orange-700, 5.18:1 on white
  5: colors.red,
};
