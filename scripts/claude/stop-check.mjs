// Stop hook: when a turn ends with uncommitted changes to the code, typechecks and runs the
// tests those changes touch. It blocks the stop once at most, and not again for the same state.

import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, hookInput } from './hookInput.mjs';

const WATCHED = ['src', 'scripts'];
const GREEN = join(ROOT, 'node_modules/.cache/claude/stop-check');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

function stateOfTheCode() {
  const hash = createHash('sha1').update(git('diff', 'HEAD', '--', ...WATCHED));
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', ...WATCHED);
  for (const path of untracked.split('\n').filter(Boolean)) {
    hash.update(path).update(readFileSync(join(ROOT, path)));
  }
  return hash.digest('hex');
}

function lastGreen() {
  try {
    return readFileSync(GREEN, 'utf8');
  } catch {
    return '';
  }
}

/** Runs one check; resolves to '' when it passes, to the end of its output when it fails. */
function failure(name, script, ...args) {
  return new Promise((done) => {
    execFile(
      process.execPath,
      [script, ...args],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) return done('');
        const tail = `${stdout}${stderr}`.trim().split('\n').slice(-60).join('\n');
        done(`${name} failed:\n${tail}`);
      }
    );
  });
}

// The stop this hook blocked is being retried: let it through, whatever the result.
if (hookInput().stop_hook_active) process.exit(0);
if (!git('status', '--porcelain', '--', ...WATCHED).trim()) process.exit(0);

const state = stateOfTheCode();
if (state === lastGreen()) process.exit(0);

const vitest = ['node_modules/vitest/vitest.mjs', 'run', '--changed', '--passWithNoTests'];
const failures = (
  await Promise.all([
    failure('npm run typecheck', 'node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'),
    failure('vitest --changed', ...vitest)
  ])
).filter(Boolean);

if (failures.length) {
  console.error(
    `${failures.join('\n\n')}\n\nFix these before ending the turn, or say what is left.`
  );
  process.exit(2);
}
mkdirSync(dirname(GREEN), { recursive: true });
writeFileSync(GREEN, state);
