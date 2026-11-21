import { describe, expect, it } from 'vitest';
import { judge } from './git-guard.mjs';

const decision = (command, branch = 'feature/x') => judge(command, branch)?.decision ?? null;

describe('ordinary git work passes', () => {
  it.each([
    'git status',
    'git add src/ui/describe.ts && git commit -m "fix: a label"',
    'git commit -am "update: the palette"',
    'git push origin main',
    'git push -u origin feature/x',
    'git branch -d feature/x',
    'git merge feature/x',
    'npm test'
  ])('%s', (command) => {
    expect(decision(command)).toBeNull();
  });

  it('a commit message may mention anything', () => {
    expect(decision('git commit -m "fix: never --force or --no-verify"')).toBeNull();
    expect(decision("git commit -F - <<'EOF'\nfix: git push --force is blocked\nEOF")).toBeNull();
  });
});

describe('what is never allowed', () => {
  it.each([
    'git commit --no-verify -m "x"',
    'git commit -nm "x"',
    'git push --force',
    'git push -f origin main',
    'git push --force-with-lease origin feature/x',
    'git push origin +main',
    'git push origin --delete feature/x',
    'git push origin :feature/x',
    'npm test && git push --force'
  ])('%s', (command) => {
    expect(decision(command)).toBe('deny');
  });
});

describe('a commit on main', () => {
  it('is put to the user', () => {
    expect(decision('git commit -m "fix: a label"', 'main')).toBe('ask');
  });

  it('is fine when the same command leaves main first', () => {
    expect(
      decision('git checkout -b fix/label && git commit -m "fix: a label"', 'main')
    ).toBeNull();
  });

  it('a merge or a push on main is not a commit', () => {
    expect(decision('git merge feature/x && git push origin main', 'main')).toBeNull();
  });
});
