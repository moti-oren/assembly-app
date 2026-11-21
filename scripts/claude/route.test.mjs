import { describe, expect, it } from 'vitest';
import { AGENTS, UI_LINES_FOR_REVIEW, route } from './route.mjs';

const file = (path, lines = 5, text = '') => ({ path, lines, text });

describe('changes that need no agent', () => {
  it.each([
    ['documentation', [file('README.md', 200), file('CLAUDE.md', 80)]],
    ['tests', [file('src/core/x86/execute.test.ts', 300), file('src/ui/sounds.test.ts', 90)]],
    ['generated shadcn components', [file('src/components/ui/button/Button.vue', 120)]],
    ['a workflow', [file('.github/workflows/deploy.yml', 40)]],
    ['nothing', []]
  ])('%s', (_, changes) => {
    const result = route(changes);
    expect(result.review).toBe(false);
    expect(result.agents).toEqual([]);
    expect(result.gates).toEqual(['npm run check']);
  });

  it('a small UI change gets the gates only', () => {
    const result = route([file('src/ui/components/HistoryLog.vue', UI_LINES_FOR_REVIEW)]);
    expect(result.agents).toEqual([]);
    expect(result.gates).toEqual(['npm run check', 'npm run check:design']);
  });
});

describe('simulator changes', () => {
  it('one line in a core is reviewed, and checked against its oracle', () => {
    const result = route([file('src/core/rv32/alu.ts', 1)], { seed: 7 });
    expect(result.agents).toEqual(['isa-correctness', 'vue-architecture']);
    expect(result.gates).toEqual(['npm run check', 'npm run verify:rv32 -- 7']);
  });

  it('the 6502 runs its own oracle only', () => {
    const { gates } = route([file('src/core/mos6502/handlers.ts')], { seed: 3 });
    expect(gates).toEqual(['npm run check', 'npm run verify:6502 -- 3']);
  });

  it('the 8086 has no oracle to run', () => {
    const result = route([file('src/core/x86/shift.ts')]);
    expect(result.gates).toEqual(['npm run check']);
    expect(result.agents).toContain('isa-correctness');
  });

  it('shared code runs both oracles', () => {
    const { gates } = route([file('src/core/shared/program.ts')], { seed: 9 });
    expect(gates).toContain('npm run verify:rv32 -- 9');
    expect(gates).toContain('npm run verify:6502 -- 9');
  });

  it('a change to an oracle runs that oracle', () => {
    const result = route([file('scripts/verify/verify-6502.py')], { seed: 4 });
    expect(result.gates).toEqual(['npm run check', 'npm run verify:6502 -- 4']);
    expect(result.agents).toEqual(['isa-correctness']);
  });
});

describe('UI changes past the threshold', () => {
  it('a component goes to design, accessibility and architecture', () => {
    const result = route([file('src/ui/components/ProgramPanel.vue', 60)]);
    expect(result.agents).toEqual(['vue-architecture', 'design-responsive', 'a11y-interaction']);
  });

  it('a style sheet goes to design and accessibility, not to architecture', () => {
    const result = route([file('src/ui/styles/panels.css', 45)]);
    expect(result.agents).toEqual(['design-responsive', 'a11y-interaction']);
  });

  it('the lines of several files add up', () => {
    const result = route([file('src/ui/describe.ts', 16), file('src/ui/groupBy.ts', 16)]);
    expect(result.agents).toEqual(['vue-architecture']);
  });

  it('the run loop and the sound engine go to performance', () => {
    for (const path of ['src/ui/useProgramRun.ts', 'src/ui/soundEngine.ts']) {
      expect(route([file(path, 40)]).agents).toContain('perf-runtime');
    }
  });

  it('so does any file whose new lines watch, measure or animate', () => {
    const quiet = route([file('src/ui/useWorkbenchView.ts', 40, 'const open = ref(false);')]);
    const hot = route([file('src/ui/useWorkbenchView.ts', 40, 'watch(open, sync);')]);
    expect(quiet.agents).not.toContain('perf-runtime');
    expect(hot.agents).toContain('perf-runtime');
  });

  it('keyboard helpers go to accessibility', () => {
    expect(route([file('src/ui/gridNavigation.ts', 40)]).agents).toContain('a11y-interaction');
  });

  it('each agent is told which files are its own', () => {
    const result = route([
      file('src/core/x86/handlers.ts', 3),
      file('src/ui/styles/diagram.css', 3),
      file('README.md', 3)
    ]);
    expect(result.files['isa-correctness']).toEqual(['src/core/x86/handlers.ts']);
    expect(result.files['design-responsive']).toEqual(['src/ui/styles/diagram.css']);
    expect(Object.values(result.files).flat()).not.toContain('README.md');
  });
});

describe('--full', () => {
  it('runs every agent on a change too small to review', () => {
    const result = route([file('src/ui/components/HistoryLog.vue', 2)], { full: true });
    expect(result.agents).toEqual(AGENTS);
  });

  it('still runs nothing when no code changed', () => {
    expect(route([file('README.md', 400)], { full: true }).agents).toEqual([]);
  });
});

describe('the build', () => {
  it('is checked when a dependency or the build configuration changes', () => {
    expect(route([file('package.json', 2)]).gates).toContain('npm run build');
    expect(route([file('src/ui/describe.ts', 2)]).gates).not.toContain('npm run build');
  });
});
