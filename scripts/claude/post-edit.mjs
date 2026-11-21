// PostToolUse hook for Edit and Write: lints and format-checks the one file that was just
// written, so a mistake is reported while the file is still open instead of at commit time.

import { spawnSync } from 'node:child_process';
import { ROOT, hookInput, repoPath } from './hookInput.mjs';

const path = repoPath(hookInput().tool_input?.file_path);
const generated = path?.startsWith('src/components/ui/');
const lints = path && !generated && /^(src|scripts)\/.*\.(ts|vue|mjs|js)$/.test(path);
// Prettier covers src only, as `npm run format:check` does.
const formats = path && !generated && /^src\/.*\.(ts|vue|css)$/.test(path);

function run(script, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? '' : `${result.stdout}${result.stderr}`.trim();
}

const problems = [];
if (lints) {
  const output = run('node_modules/eslint/bin/eslint.js', '--no-warn-ignored', path);
  if (output) problems.push(output);
}
if (formats) {
  const output = run('node_modules/prettier/bin/prettier.cjs', '--check', path);
  if (output) problems.push(`${output}\nFix it with: npx prettier --write ${path}`);
}

if (problems.length) {
  console.error(problems.join('\n\n'));
  process.exit(2);
}
