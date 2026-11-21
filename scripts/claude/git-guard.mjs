// PreToolUse hook for the shell tools: enforces the git rules of CLAUDE.md that must never be
// broken by accident (skipped hooks, a force-push, a deleted remote branch, a commit on main).

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, decide, hookInput } from './hookInput.mjs';

// Text inside quotes and heredocs is a commit message or a string, never a command.
function withoutText(command) {
  return command
    .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\s*\2\b/g, '')
    .replace(/@'[\s\S]*?'@|@"[\s\S]*?"@/g, '')
    .replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, '""');
}

function gitCalls(command) {
  return withoutText(command)
    .split(/&&|\|\||[;|\n]/)
    .map((part) => part.trim().match(/^git\s+(?:-[cC]\s+\S+\s+)*([a-z][\w-]*)(.*)$/))
    .filter(Boolean)
    .map(([, subcommand, args]) => ({ subcommand, args: ` ${args.trim()} ` }));
}

const shortFlag = (letter) => new RegExp(`\\s-[a-zA-Z]*${letter}[a-zA-Z]*\\s`);

/** @returns {{ decision: 'deny' | 'ask', reason: string } | null} */
export function judge(command, branch) {
  const calls = gitCalls(command);
  const leavesBranch = calls.some(({ subcommand }) => ['checkout', 'switch'].includes(subcommand));

  for (const { subcommand, args } of calls) {
    if (subcommand === 'commit' && (args.includes(' --no-verify ') || shortFlag('n').test(args))) {
      return {
        decision: 'deny',
        reason: 'Never skip hooks (--no-verify). Fix what the hook found.'
      };
    }
    if (subcommand === 'push') {
      if (/\s--force(-with-lease|-if-includes)?[\s=]/.test(args) || shortFlag('f').test(args)) {
        return { decision: 'deny', reason: 'Never force-push. Report why the push was rejected.' };
      }
      if (/\s\+\S/.test(args)) {
        return { decision: 'deny', reason: 'A +refspec is a force-push. Never force-push.' };
      }
      if (args.includes(' --delete ') || shortFlag('d').test(args) || /\s:\S/.test(args)) {
        return {
          decision: 'deny',
          reason: 'Remote branches are deleted only when the user explicitly asks; they do it.'
        };
      }
    }
    if (subcommand === 'commit' && branch === 'main' && !leavesBranch) {
      return {
        decision: 'ask',
        reason:
          'This commits directly to main. CLAUDE.md: one branch per task, never commit to main' +
          ' unless the user explicitly says to.'
      };
    }
  }
  return null;
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8'
    }).trim();
  } catch {
    return '';
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = hookInput();
  const command = input.tool_input?.command ?? '';
  if (/\bgit\b/.test(command)) {
    const verdict = judge(command, currentBranch(input.cwd ?? ROOT));
    if (verdict) decide(verdict.decision, verdict.reason);
  }
}
