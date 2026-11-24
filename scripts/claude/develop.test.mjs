import { describe, expect, it } from 'vitest';
import { BUILDERS, INLINE_FILES, ownerOf, plan, stray } from './develop.mjs';

describe('who writes a file', () => {
  it.each([
    ['src/core/rv32/alu.ts', 'core-builder'],
    ['src/core/rv32/alu.test.ts', 'core-builder'],
    ['src/core/aluLink.ts', 'core-builder'],
    ['scripts/verify/rv32Cases.ts', 'core-builder'],
    ['src/ui/rv32View.ts', 'ui-builder'],
    ['src/ui/components/HistoryLog.vue', 'ui-builder'],
    ['src/ui/styles/logic.css', 'ui-builder'],
    ['src/App.vue', 'ui-builder'],
    ['index.html', 'ui-builder'],
    ['README.md', 'docs-sync'],
    ['CLAUDE.md', 'docs-sync']
  ])('%s belongs to %s', (path, agent) => {
    expect(ownerOf(path)).toBe(agent);
  });

  it.each([
    'src/components/ui/button/Button.vue',
    'package.json',
    '.github/workflows/deploy.yml',
    'scripts/claude/route.mjs',
    'src/lib/utils.ts'
  ])('%s is left to the main session', (path) => {
    expect(ownerOf(path)).toBeNull();
  });
});

describe('the plan of a task', () => {
  it('runs the core before the UI, and the docs last', () => {
    const result = plan(['README.md', 'src/ui/rv32View.ts', 'src/core/rv32/alu.ts']);
    expect(result.order).toEqual(BUILDERS);
    expect(result.packages['core-builder']).toEqual(['src/core/rv32/alu.ts']);
    expect(result.packages['ui-builder']).toEqual(['src/ui/rv32View.ts']);
    expect(result.packages['docs-sync']).toEqual(['README.md']);
  });

  it('leaves out a builder with nothing to write', () => {
    const result = plan(['src/ui/sounds.ts', 'src/ui/soundPalette.ts', 'src/ui/soundEngine.ts']);
    expect(result.order).toEqual(['ui-builder']);
  });

  it('lists the files no builder owns', () => {
    const result = plan(['package.json', 'src/ui/sounds.ts']);
    expect(result.unowned).toEqual(['package.json']);
    expect(result.packages['ui-builder']).toEqual(['src/ui/sounds.ts']);
  });

  it('reads a Windows path and counts a file once', () => {
    const result = plan(['src\\core\\x86\\shift.ts', './src/core/x86/shift.ts']);
    expect(result.packages['core-builder']).toEqual(['src/core/x86/shift.ts']);
  });

  it('has nothing to run for no files', () => {
    expect(plan([])).toEqual({ inline: true, order: [], packages: {}, checks: {}, unowned: [] });
  });
});

describe('what a builder must pass', () => {
  it('a core runs its tests and its oracle', () => {
    const { checks } = plan(['src/core/rv32/alu.ts', 'src/core/rv32/alu.test.ts'], { seed: 7 });
    expect(checks['core-builder']).toEqual([
      'npm run typecheck',
      'npx vitest run --passWithNoTests src/core/rv32/alu.test.ts',
      'npm run verify:rv32 -- 7'
    ]);
  });

  it('shared code runs both oracles, the 8086 none', () => {
    const shared = plan(['src/core/shared/program.ts'], { seed: 3 }).checks['core-builder'];
    expect(shared).toContain('npm run verify:rv32 -- 3');
    expect(shared).toContain('npm run verify:6502 -- 3');
    const x86 = plan(['src/core/x86/shift.ts']).checks['core-builder'];
    expect(x86.some((check) => check.includes('verify:'))).toBe(false);
  });

  it('a component is checked for its colours, and has no test of its own', () => {
    const { checks } = plan(['src/ui/components/HistoryLog.vue']);
    expect(checks['ui-builder']).toEqual(['npm run typecheck', 'npm run check:design']);
  });

  it('a helper runs the test beside it', () => {
    const { checks } = plan(['src/ui/logicView.ts']);
    expect(checks['ui-builder']).toEqual([
      'npm run typecheck',
      'npx vitest run --passWithNoTests src/ui/logicView.test.ts'
    ]);
  });

  it('the docs have nothing to run', () => {
    expect(plan(['README.md']).checks['docs-sync']).toEqual([]);
  });
});

describe('a task small enough for the main session', () => {
  const files = (count) => Array.from({ length: count }, (_, i) => `src/ui/helper${i}.ts`);

  it('is a few files of one builder, tests and docs not counted', () => {
    const paths = [...files(INLINE_FILES), 'src/ui/helper0.test.ts', 'README.md'];
    expect(plan(paths).inline).toBe(true);
  });

  it('is not one file more', () => {
    expect(plan(files(INLINE_FILES + 1)).inline).toBe(false);
  });

  it('is never a task for two builders', () => {
    expect(plan(['src/core/rv32/alu.ts', 'src/ui/rv32View.ts']).inline).toBe(false);
  });
});

describe('files outside a builder’s own', () => {
  it('are named', () => {
    const changed = ['src/core/rv32/alu.ts', 'src/ui/rv32View.ts', 'package.json'];
    expect(stray('core-builder', changed)).toEqual(['src/ui/rv32View.ts', 'package.json']);
  });

  it('are none when it stayed in its files', () => {
    expect(stray('ui-builder', ['src/ui/sounds.ts', 'src\\App.vue'])).toEqual([]);
  });

  it('cannot be asked of an agent that writes nothing', () => {
    expect(() => stray('feature-scout', [])).toThrow('Unknown builder');
  });
});
