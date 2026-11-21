// Decides, from the files a change touches, which deterministic gates and which review agents
// /verify runs. Usage: node scripts/claude/route.mjs [--full] [--base <ref>]

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AGENTS = [
  'isa-correctness',
  'vue-architecture',
  'design-responsive',
  'a11y-interaction',
  'perf-runtime'
];

// A UI change this small gets the deterministic gates only.
export const UI_LINES_FOR_REVIEW = 30;

const BUILD_INPUTS = [
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'index.html',
  'components.json'
];
const KEYBOARD_HELPERS = /^src\/ui\/(useCommands|gridNavigation|builderKeys|useKeyboardInset)\.ts$/;
const HOT_PATHS =
  /^src\/ui\/(useProgramRun|useCpu\w*|usePhaseStepping|useDataFlow|useSoundEffects|sound\w*)\.ts$|^src\/ui\/components\/(FlatMemory|SortableColumn|CycleStrip)\.vue$/;
const HOT_CODE =
  /\bwatch(Effect)?\(|requestAnimationFrame|getBoundingClientRect|ResizeObserver|AudioContext|setInterval|@keyframes|\btransition\b|\banimation\b/;

const isTest = (path) => /\.test\.(ts|mjs)$/.test(path);
const isGenerated = (path) => path.startsWith('src/components/ui/');
const isSource = (path) =>
  /^src\/.*\.(ts|vue|css)$/.test(path) && !isTest(path) && !isGenerated(path);
const isCore = (path) => path.startsWith('src/core/') && isSource(path);
const isOracle = (path) => path.startsWith('scripts/verify/');
const isDesign = (path) =>
  isSource(path) &&
  (/^src\/ui\/components\/.*\.vue$/.test(path) || path === 'src/App.vue' || path.endsWith('.css'));

const TRIGGERS = {
  'isa-correctness': ({ path }) =>
    isCore(path) || isOracle(path) || path === 'src/ui/rv32Pipeline.ts',
  'vue-architecture': ({ path }) => isSource(path) && !path.endsWith('.css'),
  'design-responsive': ({ path }) => isDesign(path),
  'a11y-interaction': ({ path }) => isDesign(path) || KEYBOARD_HELPERS.test(path),
  'perf-runtime': ({ path, text = '' }) =>
    isSource(path) && (HOT_PATHS.test(path) || HOT_CODE.test(text))
};

const touches = (changes, test) => changes.some(({ path }) => test(path));

function gates(changes, seed) {
  const list = ['npm run check'];
  if (touches(changes, isDesign)) list.push('npm run check:design');
  const shared = (path) => path.startsWith('src/core/shared/') && isCore(path);
  const verifies = (folder, oracle) => (path) =>
    (path.startsWith(`src/core/${folder}/`) && isCore(path)) ||
    shared(path) ||
    (isOracle(path) && oracle.test(path));
  if (touches(changes, verifies('rv32', /rv32/i))) list.push(`npm run verify:rv32 -- ${seed}`);
  if (touches(changes, verifies('mos6502', /6502/))) list.push(`npm run verify:6502 -- ${seed}`);
  if (touches(changes, (path) => BUILD_INPUTS.includes(path))) list.push('npm run build');
  return list;
}

/**
 * @param {{ path: string, lines?: number, text?: string }[]} changes  each changed file, the
 *   number of lines added and removed in it, and the text of its added lines
 * @param {{ full?: boolean, seed?: number }} [options]
 */
export function route(changes, { full = false, seed = 1 } = {}) {
  const uiLines = changes
    .filter(({ path }) => isSource(path) && !isCore(path))
    .reduce((sum, { lines = 0 }) => sum + lines, 0);
  const simulation = touches(changes, (path) => isCore(path) || isOracle(path));
  const reviewable = touches(
    changes,
    (path) => (path.startsWith('src/') && !isGenerated(path)) || path.startsWith('scripts/')
  );

  let reason = `the gates are enough: ${uiLines} UI lines changed, no simulator code`;
  if (full && reviewable) reason = '--full: every agent runs';
  else if (simulation) reason = 'simulator code changed';
  else if (uiLines > UI_LINES_FOR_REVIEW)
    reason = `${uiLines} UI lines changed (more than ${UI_LINES_FOR_REVIEW})`;
  const review = (full && reviewable) || simulation || uiLines > UI_LINES_FOR_REVIEW;

  const files = {};
  for (const agent of review ? AGENTS : []) {
    const matched = changes.filter(TRIGGERS[agent]).map(({ path }) => path);
    if (matched.length || full) files[agent] = matched;
  }
  return { review, reason, gates: gates(changes, seed), agents: Object.keys(files), files };
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function addedText(base, path) {
  return git('diff', '-U0', '--no-renames', base, '--', path)
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .join('\n');
}

/** Everything that differs from the base: commits on this branch, the working tree, new files. */
function collectChanges(baseRef) {
  const base = git('merge-base', 'HEAD', baseRef).trim();
  const tracked = git('diff', '--numstat', '--no-renames', base)
    .split('\n')
    .filter(Boolean)
    .map((row) => {
      const [added, removed, path] = row.split('\t');
      const lines = (Number(added) || 0) + (Number(removed) || 0);
      return { path, lines, text: addedText(base, path) };
    });
  const untracked = git('ls-files', '--others', '--exclude-standard')
    .split('\n')
    .filter(Boolean)
    .map((path) => {
      const text = readFileSync(path, 'utf8');
      return { path, lines: text.split('\n').length, text };
    });
  return [...tracked, ...untracked];
}

function main(args) {
  const baseAt = args.indexOf('--base');
  const changes = collectChanges(baseAt === -1 ? 'main' : args[baseAt + 1]);
  // A new seed on every run, printed in the gate so a failure can be run again.
  const seed = 2 + (Math.floor(Date.now() / 1000) % 9998);
  const result = route(changes, { full: args.includes('--full'), seed });
  const changed = changes.map(({ path }) => path);
  process.stdout.write(JSON.stringify({ changed, ...result }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
