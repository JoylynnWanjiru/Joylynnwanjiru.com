import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Phase 1 "done when": both themes pass contrast checks (brief sections 3 and 9).
// Reads the tokens straight from global.css so a changed colour fails here.
const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name, hex] of block.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[name] = hex;
  return out;
}

function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`${selector} not found in global.css`);
  return css.slice(start, css.indexOf('}', start));
}

const light = tokens(block(':root{'));
const dark = tokens(block(':root[data-theme="dark"]{'));
const darkSystem = tokens(block(':root:not([data-theme="light"]){'));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text, background, minimum]. 4.5 is AA for body text, 3 for large text.
// Pairings follow the usage rules in brief section 3.
const PAIRS: [string, string, number][] = [
  ...['bg', 'soft', 'wash', 'tint'].map((bg): [string, string, number] => ['ink', bg, 4.5]),
  ...['bg', 'soft', 'wash'].map((bg): [string, string, number] => ['muted', bg, 4.5]),
  ...['bg', 'soft', 'wash'].map((bg): [string, string, number] => ['blue', bg, 4.5]),
  ...['bg', 'soft', 'wash', 'tint'].map((bg): [string, string, number] => ['pink-text', bg, 4.5]),
  ['on-blue', 'blue', 4.5],
  ...['bg', 'wash'].map((bg): [string, string, number] => ['pink', bg, 3]),
];

describe('colour contrast (WCAG 2.2 AA)', () => {
  it('uses the same dark tokens for the system and the toggle', () => {
    expect(darkSystem).toEqual(dark);
  });

  for (const [name, theme] of [['light', light], ['dark', dark]] as const) {
    it.each(PAIRS)(`${name}: --%s on --%s is at least %s:1`, (fg, bg, min) => {
      expect(theme[fg], `--${fg} missing`).toBeDefined();
      expect(theme[bg], `--${bg} missing`).toBeDefined();
      expect(ratio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(min);
    });
  }
});
