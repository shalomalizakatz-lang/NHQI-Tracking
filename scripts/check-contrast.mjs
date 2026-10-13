#!/usr/bin/env node
// WCAG 2.2 contrast checker run directly against the literal color pairs in
// src/lib/designTokens.js -- cheaper and more precise than sampling rendered
// screenshot pixels. Prints a pass/fail table; exits 1 if any required pair fails.
import { colors, quintileScale } from "../src/lib/designTokens.js";

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hexA, hexB) {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

// [label, foreground, background, minimum ratio, context]
const pairs = [
  ["Body ink on page", colors.ink, colors.page, 4.5, "normal text"],
  ["Body ink on surface", colors.ink, colors.surface, 4.5, "normal text"],
  ["Secondary ink on surface", colors.inkSecondary, colors.surface, 4.5, "normal text"],
  ["Muted ink on surface", colors.inkMuted, colors.surface, 4.5, "normal text"],
  ["Accent text on accent bg (badge)", colors.accentText, colors.accentBg, 4.5, "normal text"],
  ["Accent on surface (links/controls)", colors.accent, colors.surface, 3.0, "UI component"],
  ["Amber text on amber bg (badge)", colors.amberText, colors.amberBg, 4.5, "normal text"],
  ["Red text on red bg (badge)", colors.redText, colors.redBg, 4.5, "normal text"],
  ["Red on surface (error text)", colors.red, colors.surface, 4.5, "normal text"],
  ["Green on surface (success text)", colors.green, colors.surface, 4.5, "normal text"],
  // Plain `border`/`borderSubtle` are decorative dividers (table rows, card
  // edges) whose boundary is also conveyed by spacing/content -- intentionally
  // not checked here. `borderControl` is the one load-bearing boundary (input/
  // button/interactive outlines) that must clear the 3:1 non-text minimum.
  ["Control border on surface (input/button outline)", colors.borderControl, colors.surface, 3.0, "UI component"],
  // qColor() (colors.js) hands each of these out as a bare inline text color
  // on white/light surfaces (e.g. PriorityList's "Q2 -> Q1" label) -- an
  // earlier version used the lighter Tailwind -600 swatches here and an
  // axe-core sweep caught 3 of the 5 failing at ~3.0-3.6:1. Checked here so
  // that regression can't silently come back.
  ["Quintile 1 text on surface", quintileScale[1], colors.surface, 4.5, "normal text"],
  ["Quintile 2 text on surface", quintileScale[2], colors.surface, 4.5, "normal text"],
  ["Quintile 3 text on surface", quintileScale[3], colors.surface, 4.5, "normal text"],
  ["Quintile 4 text on surface", quintileScale[4], colors.surface, 4.5, "normal text"],
  ["Quintile 5 text on surface", quintileScale[5], colors.surface, 4.5, "normal text"],
];

let allPass = true;
console.log("WCAG 2.2 contrast check — src/lib/designTokens.js\n");
console.log("Pair".padEnd(42), "Ratio".padEnd(8), "Min".padEnd(6), "Result");
console.log("-".repeat(70));
for (const [label, fg, bg, min, context] of pairs) {
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= min;
  allPass = allPass && pass;
  console.log(
    label.padEnd(42),
    ratio.toFixed(2).padEnd(8),
    `${min.toFixed(1)}:1`.padEnd(6),
    pass ? "PASS" : "FAIL",
    `(${context})`
  );
}
console.log("-".repeat(70));
console.log(allPass ? "All pairs pass their WCAG 2.2 AA minimum." : "One or more pairs FAIL — fix before shipping.");
process.exit(allPass ? 0 : 1);
