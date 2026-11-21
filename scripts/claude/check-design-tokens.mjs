// Fails when a component or a style sheet writes a colour itself instead of using a theme token.
// Every colour belongs in src/ui/styles.css, where its light and dark values sit side by side.
// Usage: node scripts/claude/check-design-tokens.mjs [file ...]   (no files: all of the UI)

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TOKEN_SHEET = 'src/ui/styles.css';
const ALLOW = 'design-tokens: allow';

const RAW_COLOUR =
  /(?<![&\w(])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
const PALETTE_CLASS =
  /\b(?:text|bg|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/g;
// `in oklch` names the space a color-mix works in; it is not a colour.
const COLOUR_SPACE = /\bin (?:oklch|oklab|lab|lch|srgb|hsl|hwb)\b/g;
// A mask only reads alpha, and #0000 is no colour at all.
const NOT_A_COLOUR = /\bmask(?:-image)?\s*:|#0000\b/;

// Colours that were in the code before this check existed. They are reported, not failed:
// move each to a token (or mark it with the allow comment) and delete its entry.
const KNOWN = [
  { file: 'src/ui/components/DevicesPanel.vue', has: 'scrollbar-color:oklch(1_0_0/30%)' },
  { file: 'src/ui/styles/devices.css', has: '#fff7ed' },
  { file: 'src/ui/styles/devices.css', has: '--written: #fb923c' }
];

const inScope = (file) =>
  (file === 'src/App.vue' || /^src\/ui\/.*\.(vue|css)$/.test(file)) && file !== TOKEN_SHEET;

function allUiFiles(folder = 'src/ui') {
  return readdirSync(join(ROOT, folder), { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`;
    return entry.isDirectory() ? allUiFiles(path) : [path];
  });
}

function findings(file) {
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
  return lines.flatMap((line, index) => {
    if (line.includes(ALLOW) || lines[index - 1]?.includes(ALLOW)) return [];
    if (NOT_A_COLOUR.test(line)) return [];
    const found = [
      ...(line.replace(COLOUR_SPACE, '').match(RAW_COLOUR) ?? []),
      ...(line.match(PALETTE_CLASS) ?? [])
    ];
    if (!found.length) return [];
    const known = KNOWN.some((entry) => entry.file === file && line.includes(entry.has));
    return [{ file, line: index + 1, found: found.join(', '), known }];
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

for (const { file, line, found } of fresh) console.error(`${file}:${line}  raw colour: ${found}`);
if (known.length) {
  console.log(`${known.length} known raw colours, kept until they move to tokens:`);
  for (const { file, line, found } of known) console.log(`  ${file}:${line}  ${found}`);
}
if (fresh.length) {
  console.error(
    `\n${fresh.length} raw colours. Use a token from ${TOKEN_SHEET} (add one there if none fits),` +
      ` or put "${ALLOW}" in a comment on the line above with the reason.`
  );
  process.exit(1);
}
console.log(`Design tokens: ${files.length} files, no new raw colours.`);
