// The approved palette as rules: which hue family a colour belongs to, and which colour words
// are foreign to it. Cool neutrals, blue for a read, orange for a write, red for an error.

const TAILWIND_HUES =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|taupe|mauve|mist|olive';
// Any utility (`bg-pink-500`, `inset-ring-rose-300/40`) and the theme variable (`--color-teal-600`).
const PALETTE_CLASS = new RegExp(
  `(?<![\\w])(?:[a-z-]+-)?(?:${TAILWIND_HUES})-(?:50|[1-9]00|950)\\b`,
  'g'
);

const CSS_NAMES =
  'red|crimson|firebrick|tomato|coral|salmon|orange|darkorange|gold|yellow|khaki|lime|green|limegreen|seagreen|olive|teal|aqua|cyan|turquoise|blue|navy|royalblue|dodgerblue|skyblue|steelblue|indigo|violet|purple|rebeccapurple|magenta|fuchsia|orchid|plum|pink|hotpink|deeppink|brown|maroon|beige|ivory|tan|gray|grey|silver|white|black';
const COLOUR_PROPERTY =
  '(?:color|background(?:-color)?|border(?:-[a-z]+)*|outline(?:-color)?|fill|stroke|(?:box|text)-shadow|caret-color|accent-color|--[\\w-]+)';
const NAMED_COLOUR = new RegExp(
  `(?<![\\w-])${COLOUR_PROPERTY}\\s*:[^;{}]*?(?<![\\w-])(${CSS_NAMES})(?![\\w-])`,
  'i'
);

const COLOUR_LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgba?|oklch)\([^)]*\)/gi;

/** The Tailwind palette classes on a line: none of them is ours. */
export const paletteClasses = (line) => line.match(PALETTE_CLASS) ?? [];

/** The CSS colour keyword a declaration on this line uses, or null. */
export const namedColour = (line) => line.match(NAMED_COLOUR)?.[1] ?? null;

/** Every colour written out on a line of the token sheet. */
export const colourLiterals = (line) => line.match(COLOUR_LITERAL) ?? [];

const linear = (channel) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

function rgbToOklch(r, g, b) {
  const [lr, lg, lb] = [r, g, b].map((channel) => linear(channel / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bAxis = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(bAxis, a) * 180) / Math.PI;
  return { chroma: Math.hypot(a, bAxis), hue: (hue + 360) % 360 };
}

function hexToRgb(hex) {
  const digits = hex.slice(1);
  const pairs =
    digits.length <= 4 ? [...digits].map((digit) => digit + digit) : digits.match(/../g);
  return pairs.slice(0, 3).map((pair) => parseInt(pair, 16));
}

/** Chroma and hue of a hex, `rgb()` or `oklch()` colour, or null when it is none of them. */
export function toOklch(colour) {
  if (colour.startsWith('#')) return rgbToOklch(...hexToRgb(colour));
  const numbers = (colour.match(/-?[\d.]+%?/g) ?? []).map((part) =>
    part.endsWith('%') ? parseFloat(part) / 100 : parseFloat(part)
  );
  if (numbers.length < 3) return null;
  if (/^oklch/i.test(colour)) return { chroma: numbers[1], hue: ((numbers[2] % 360) + 360) % 360 };
  if (/^rgba?/i.test(colour)) return rgbToOklch(...numbers);
  return null;
}

const GREY_CHROMA = 0.02;
const COOL_GREY_CHROMA = 0.07;
// Hue ranges in OKLCH degrees, [from, to).
const HUES = [
  ['pink', 0, 20],
  ['red', 20, 34],
  ['orange', 34, 80],
  ['yellow', 80, 110],
  ['green', 110, 170],
  ['teal', 170, 225],
  ['blue', 225, 275],
  ['purple', 275, 340],
  ['pink', 340, 360]
];

/**
 * The family of a colour: `neutral`, `blue`, `orange`, `red`, or a foreign one (`pink`, `green`,
 * `tinted grey`, …). A grey may lean cool (towards blue), and nowhere else.
 */
export function family(colour) {
  const lch = toOklch(colour);
  if (!lch || lch.chroma < GREY_CHROMA) return 'neutral';
  const name = HUES.find(([, from, to]) => lch.hue >= from && lch.hue < to)[0];
  if (lch.chroma < COOL_GREY_CHROMA && name !== 'orange' && name !== 'red') {
    return name === 'blue' ? 'neutral' : 'tinted grey';
  }
  return name;
}

/** Whether a token of this name may hold a colour of this family. Red is for an error only. */
export function allowedFor(tokenName, colourFamily) {
  if (colourFamily === 'red') return /destructive|error/.test(tokenName);
  return ['neutral', 'blue', 'orange'].includes(colourFamily);
}
