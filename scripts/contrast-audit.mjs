/**
 * Contrast audit for the status colours.
 *
 * Colour never carries meaning alone in PokéMed, but the colour that is
 * there still has to be readable. This checks every foreground/background
 * pairing used by a status indicator, in both themes, against WCAG AA.
 *
 *   node scripts/contrast-audit.mjs
 */

import { readFileSync } from "node:fs";

const rgb = (s) => s.trim().split(/\s+/).map(Number);

const css = (file) => {
  const text = readFileSync(file, "utf8");
  // Pull the two variable blocks out by their selector, then read the
  // `--c-name: 1 2 3;` declarations inside each one.
  const blockOf = (selector) => {
    const start = text.indexOf(selector);
    if (start === -1) return "";
    const open = text.indexOf("{", start);
    const close = text.indexOf("}", open);
    return text.slice(open, close);
  };
  const parse = (block) => {
    const out = {};
    for (const m of block.matchAll(/--(c-[a-z0-9-]+):\s*([\d ]+);/g)) out[m[1]] = rgb(m[2]);
    return out;
  };
  return {
    light: parse(blockOf(":root")),
    dark: parse(blockOf('[data-theme="dark"]')),
  };
};

const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const themes = css("app/globals.css");

// Every pairing a status indicator actually renders.
const checks = [
  ["taken pill", "c-brand-700", "c-brand-50", 4.5],
  ["missed pill", "c-alert", "c-red-50", 4.5],
  ["due pill", "c-warn", "c-amber-50", 4.5],
  ["missed count", "c-alert", "c-surface", 4.5],
  ["taken count", "c-brand-900", "c-brand-50", 4.5],
  ["missed text on card", "c-alert", "c-surface", 4.5],
  ["warn text on card", "c-warn", "c-surface", 4.5],
  ["muted text on card", "c-muted", "c-surface", 4.5],
  ["body text on card", "c-ink", "c-surface", 4.5],
  ["body text on paper", "c-ink", "c-paper", 4.5],
  ["muted text on paper", "c-muted", "c-paper", 4.5],
  ["primary button label", "white", "c-brand-600", 4.5],
  ["danger button label", "white", "c-alert-solid", 4.5],
  ["primary button hover", "white", "c-brand-hover", 4.5],
  ["danger button hover", "white", "c-alert-hover", 4.5],
  ["toast success label", "white", "c-brand-600", 4.5],
  ["toast error label", "white", "c-alert-solid", 4.5],
  ["alert badge icon", "white", "c-alert-solid", 3.0],
  ["week bar: all taken", "white", "c-brand-600", 3.0],
  ["week bar: some missed", "c-on-amber", "c-amber-400", 3.0],
  ["week bar: mostly missed", "white", "c-alert-solid", 3.0],
  ["week bar: empty", "c-muted", "c-line", 3.0],
  ["logo name on card", "c-logo-navy", "c-surface", 4.5],
  ["logo name on paper", "c-logo-navy", "c-paper", 4.5],
  ["logo accent on paper", "c-logo-teal", "c-paper", 3.0],
  ["focus ring on paper", "c-focus", "c-paper", 3.0],
  ["elder taken button", "white", "c-taken", 4.5],
];

let failures = 0;
for (const theme of ["light", "dark"]) {
  const t = themes[theme];
  console.log(`\n${theme.toUpperCase()}`);
  for (const [label, fg, bg, min] of checks) {
    const a = fg === "white" ? [255, 255, 255] : t[fg];
    const b = bg === "white" ? [255, 255, 255] : t[bg];
    if (!a || !b) {
      console.log(`  ??   ${label} — missing token`);
      failures++;
      continue;
    }
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(`  ${ok ? "OK " : "FAIL"}  ${r.toFixed(2).padStart(5)}:1 (need ${min})  ${label}`);
  }
}

console.log(failures === 0 ? "\nAll pairings meet their target." : `\n${failures} pairing(s) below target.`);
process.exit(failures === 0 ? 0 : 1);
