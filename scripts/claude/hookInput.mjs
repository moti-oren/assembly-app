// What every Claude Code hook in this folder starts from: the event it was given on stdin, and
// the repository it runs in.

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function hookInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

/** A path as git writes it, relative to the repository; null for a file outside it. */
export function repoPath(file) {
  if (!file) return null;
  const path = relative(ROOT, resolve(ROOT, file)).replaceAll('\\', '/');
  return path.startsWith('..') ? null : path;
}

/** Answers a PreToolUse hook: 'deny' stops the tool call, 'ask' puts it to the user. */
export function decide(permissionDecision, permissionDecisionReason) {
  const hookSpecificOutput = {
    hookEventName: 'PreToolUse',
    permissionDecision,
    permissionDecisionReason
  };
  process.stdout.write(JSON.stringify({ hookSpecificOutput }));
}
