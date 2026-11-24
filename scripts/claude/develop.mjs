// Decides, from the files a task is planned to touch, which builder agent of /develop writes each
// one, in what order they run and what each must pass.
// Usage: node scripts/claude/develop.mjs <path>...   |   --stray <agent> <path>...

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDesign, isGenerated, isOracle, oracles } from './route.mjs';

// The order they run in: the UI is written against what the core exports, the docs against both.
export const BUILDERS = ['core-builder', 'ui-builder', 'docs-sync'];

// A task this small, in one builder's files, is written by the main session itself.
export const INLINE_FILES = 2;

const UI_ROOT_FILES = ['src/App.vue', 'src/main.ts', 'index.html'];
const DOCS = ['README.md', 'CLAUDE.md'];

const OWNS = {
  'core-builder': (path) => path.startsWith('src/core/') || isOracle(path),
  'ui-builder': (path) => path.startsWith('src/ui/') || UI_ROOT_FILES.includes(path),
  'docs-sync': (path) => DOCS.includes(path)
};

const isTest = (path) => /\.test\.ts$/.test(path);
const clean = (path) => path.replaceAll('\\', '/').replace(/^\.\//, '');

/** The builder that writes this file, or null for one that is left to the main session. */
export function ownerOf(path) {
  if (isGenerated(path)) return null;
  return BUILDERS.find((agent) => OWNS[agent](path)) ?? null;
}

/** The test beside each TypeScript file, once each. */
function testsOf(paths) {
  const tests = paths
    .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts'))
    .map((path) => (isTest(path) ? path : path.replace(/\.ts$/, '.test.ts')));
  return [...new Set(tests)];
}

function checksOf(agent, paths, seed) {
  if (agent === 'docs-sync') return [];
  const list = ['npm run typecheck'];
  const tests = testsOf(paths);
  if (tests.length) list.push(`npx vitest run --passWithNoTests ${tests.join(' ')}`);
  if (paths.some(isDesign)) list.push('npm run check:design');
  for (const oracle of oracles(paths)) list.push(`npm run ${oracle} -- ${seed}`);
  return list;
}

/**
 * @param {string[]} paths  the files the task is planned to change or create
 * @param {{ seed?: number }} [options]
 */
export function plan(paths, { seed = 1 } = {}) {
  const all = [...new Set(paths.map(clean))];
  const packages = {};
  const checks = {};
  for (const agent of BUILDERS) {
    const files = all.filter((path) => ownerOf(path) === agent);
    if (!files.length) continue;
    packages[agent] = files;
    checks[agent] = checksOf(agent, files, seed);
  }
  const order = Object.keys(packages);
  const writers = order.filter((agent) => agent !== 'docs-sync');
  const written = writers.flatMap((agent) => packages[agent]).filter((path) => !isTest(path));
  return {
    inline: writers.length <= 1 && written.length <= INLINE_FILES,
    order,
    packages,
    checks,
    unowned: all.filter((path) => ownerOf(path) === null)
  };
}

/** Of the files an agent changed, the ones that are not its own to write. */
export function stray(agent, paths) {
  if (!BUILDERS.includes(agent)) throw new Error(`Unknown builder: ${agent}`);
  return [...new Set(paths.map(clean))].filter((path) => ownerOf(path) !== agent);
}

function main(args) {
  let result;
  if (args[0] === '--stray') {
    const [, agent, ...paths] = args;
    result = { agent, stray: stray(agent, paths) };
  } else {
    // A new seed on every run, printed in the check so a failure can be run again.
    result = plan(args, { seed: 2 + (Math.floor(Date.now() / 1000) % 9998) });
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
