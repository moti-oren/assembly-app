// Fails when a component or a style sheet writes a colour itself instead of using a theme token,
// or uses a colour from outside the palette: cool neutrals, blue (a read), orange (a write) and
// red (an error). Every colour belongs in src/ui/styles.css, light and dark side by side, and the
// sheet itself is checked too: a token of a foreign hue is how a pink tag once got through.
// Usage: node scripts/claude/check-design-tokens.mjs [file ...]   (no files: all of the UI)

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allowedFor,
  colourLiterals,
  family,
  namedColour,
  paletteClasses
} from './designPalette.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TOKEN_SHEET = 'src/ui/styles.css';
const ALLOW = 'design-tokens: allow';

const RAW_COLOUR =
  /(?<![&\w(])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
// `in oklch` names the space a color-mix works in; it is not a colour.
const COLOUR_SPACE = /\bin (?:oklch|oklab|lab|lch|srgb|hsl|hwb)\b/g;
// A mask only reads alpha, and #0000 is no colour at all.
const NOT_A_COLOUR = /\bmask(?:-image)?\s*:|#0000\b/;

// The one place hues tell things apart: a colour per field of an encoding. These tokens may be
// of a foreign hue, and may be used in the encoding panels only.
const ENCODING_TOKENS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-6'];
const ENCODING_PANELS = [
  'src/ui/components/EncodingPanel.vue',
  'src/ui/components/Rv32Encoding.vue',
  'src/ui/components/Mos6502Encoding.vue'
];

// Colours that were in the code before a rule existed. They are reported, not failed:
// move each to a token of the palette (or mark it with the allow comment) and delete its entry.
const KNOWN = [
  // The pink of an encoding field. It left the 8086's panel; RISC-V's immediate still wears it.
  { file: TOKEN_SHEET, has: '--chart-5:' },
  { file: 'src/ui/components/Rv32Encoding.vue', has: 'chart-5' }
];

const inScope = (file) => file === 'src/App.vue' || /^src\/ui\/.*\.(vue|css)$/.test(file);

function allUiFiles(folder = 'src/ui') {
  return readdirSync(join(ROOT, folder), { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`;
    return entry.isDirectory() ? allUiFiles(path) : [path];
  });
}

const readLines = (file) => readFileSync(join(ROOT, file), 'utf8').split('\n');
const tokenName = (line) => line.match(/^\s*--([\w-]+)\s*:/)?.[1] ?? null;

/** The tokens of the sheet whose colour is outside the palette, by name. */
function foreignTokens() {
  const foreign = new Map();
  for (const line of readLines(TOKEN_SHEET)) {
    const name = tokenName(line);
    if (!name) continue;
    const hue = colourLiterals(line)
      .map(family)
      .find((found) => !allowedFor(name, found));
    if (hue) foreign.set(name, hue);
  }
  return foreign;
}

const FOREIGN = foreignTokens();
const tokenUse = (name) => new RegExp(`(?<![\\w])[a-z-]*${name}(?![\\w-])`);

/** A token of a foreign hue defined on this line of the sheet. */
function sheetProblems(line) {
  const name = tokenName(line);
  if (!name || !FOREIGN.has(name) || ENCODING_TOKENS.includes(name)) return [];
  return [`${FOREIGN.get(name)} token: --${name}`];
}

/** What a line of a component or an area's style sheet gets wrong. */
/** What a line of a component or an area's style sheet gets wrong. */
function lineProblems(file, line) {
  const raw = NOT_A_COLOUR.test(line) ? [] : line.replace(COLOUR_SPACE, '').match(RAW_COLOUR);
  const named = namedColour(line);
  const uses = (name) => tokenUse(name).test(line);
  const strayEncoding = ENCODING_PANELS.includes(file) ? [] : ENCODING_TOKENS.filter(uses);
  const foreign = [...FOREIGN.keys()].filter((name) => !ENCODING_TOKENS.includes(name));
  return [
    ...(raw ?? []).map((found) => `raw colour: ${found}`),
    ...paletteClasses(line).map((found) => `Tailwind palette colour: ${found}`),
    ...(named ? [`named colour: ${named}`] : []),
    ...foreign.filter(uses).map((name) => `${FOREIGN.get(name)} token: ${name}`),
    ...strayEncoding.map((name) => `encoding colour outside an encoding panel: ${name}`)
  ];
}

function findings(file) {
  const lines = readLines(file);
  return lines.flatMap((line, index) => {
    if (line.includes(ALLOW) || lines[index - 1]?.includes(ALLOW)) return [];
    const found = file === TOKEN_SHEET ? sheetProblems(line) : lineProblems(file, line);
    if (!found.length) return [];
    const known = KNOWN.some((entry) => entry.file === file && line.includes(entry.has));
    return [{ file, line: index + 1, found: found.join('; '), known }];
  });
}

const args = process.argv.slice(2);
const files = (
  args.length
    ? args.map((arg) => relative(ROOT, resolve(arg)).replaceAll('\\', '/'))
    : [...allUiFiles(), 'src/App.vue']
).filter(inScope);

const all = files.flatMap(findings);
const fresh = all.filter((finding) => !finding.known);
const known = all.filter((finding) => finding.known);

for (const { file, line, found } of fresh) console.error(`${file}:${line}  ${found}`);
if (known.length) {
  console.log(`${known.length} known colours, kept until they move to the palette:`);
  for (const { file, line, found } of known) console.log(`  ${file}:${line}  ${found}`);
}
if (fresh.length) {
  console.error(
    `\n${fresh.length} colour problems. Use a token of the palette from ${TOKEN_SHEET} (add one there if none fits),` +
      ` or put "${ALLOW}" in a comment on the line above with the reason.`
  );
  process.exit(1);
}
console.log(`Design tokens: ${files.length} files, no new colours outside the palette.`);
