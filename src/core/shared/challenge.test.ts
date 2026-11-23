import { describe, expect, it } from 'vitest';
import { checkChallenge, givenLines, type Challenge } from './challenge';
import { CpuError } from './cpuError';
import type { ExecutionRecord } from './executionRecord';
import type { LineRunner } from './program';

/** A CPU with one number: `set n`, `add n`, `dbl` and `jmp line`. */
interface Toy {
  mnemonic: 'set' | 'add' | 'dbl' | 'jmp' | 'bad';
  operands: { type: 'imm' | 'label'; value: number }[];
}
interface ToyState {
  value: number;
  line: number;
}

const record = (instruction: Toy): ExecutionRecord => ({
  instruction,
  line: null,
  before: { registers: {}, flags: 0 },
  memoryWrites: [],
  portWrites: [],
  registersWritten: []
});

const TOY: LineRunner<Toy, ToyState, ExecutionRecord> & { createState(): ToyState } = {
  createState: () => ({ value: 0, line: 0 }),
  nextLine: (state) => state.line,
  execute(state, instruction) {
    const [operand] = instruction.operands;
    state.line += 1;
    if (instruction.mnemonic === 'set') state.value = operand.value;
    if (instruction.mnemonic === 'add') state.value += operand.value;
    if (instruction.mnemonic === 'dbl') state.value *= 2;
    if (instruction.mnemonic === 'jmp') state.line = operand.value;
    if (instruction.mnemonic === 'bad') throw new CpuError('It broke');
    return record(instruction);
  }
};

const set = (value: number): Toy => ({ mnemonic: 'set', operands: [{ type: 'imm', value }] });
const add = (value: number): Toy => ({ mnemonic: 'add', operands: [{ type: 'imm', value }] });
const dbl: Toy = { mnemonic: 'dbl', operands: [] };

/** Four times the value the given line sets, without ADD. */
const QUADRUPLE: Challenge<Toy, ToyState> = {
  id: 'quadruple',
  title: 'Four times',
  brief: 'Make the value four times what it starts as.',
  hint: 'Double it twice.',
  goals: ['The value is four times what it was'],
  cases: [
    { given: [set(3)], met: [(state) => state.value === 12] },
    { given: [set(5)], met: [(state) => state.value === 20] }
  ],
  limits: { lines: 2, without: [{ label: 'No ADD', mnemonics: ['add'] }], noNumbers: true },
  par: 2
};

const check = (program: Toy[]) => checkChallenge(TOY, QUADRUPLE, program);

describe('checkChallenge', () => {
  it('starts every program with the first case', () => {
    expect(givenLines(QUADRUPLE)).toEqual([set(3)]);
  });

  it('passes a program that meets the goal in every case and keeps to the limits', () => {
    const result = check([set(3), dbl, dbl]);
    expect(result.solved).toBe(true);
    expect(result.lines).toBe(2);
    expect(result.goals).toEqual([{ label: 'The value is four times what it was', met: true }]);
    expect(result.limits).toEqual([
      { label: 'At most 2 lines', met: true },
      { label: 'No ADD', met: true },
      { label: 'No number written in an instruction', met: true }
    ]);
  });

  it('is not fooled by a program that writes the first answer down', () => {
    const result = check([set(3), set(12)]);
    expect(result.goals[0].met).toBe(false);
    expect(result.solved).toBe(false);
  });

  it('does not pass the given lines alone', () => {
    expect(check([set(3)]).solved).toBe(false);
  });

  it('names each limit a program breaks, though it meets the goal', () => {
    const result = check([set(3), add(3), dbl, add(0)]);
    expect(result.goals[0].met).toBe(false);
    const broken = check([set(3), dbl, dbl, add(0)]);
    expect(broken.goals[0].met).toBe(true);
    expect(broken.limits.map((limit) => limit.met)).toEqual([false, false, false]);
    expect(broken.solved).toBe(false);
  });

  it('meets nothing once the given lines were changed', () => {
    const result = check([set(4), dbl, dbl]);
    expect(result.givenKept).toBe(false);
    expect(result.goals[0].met).toBe(false);
    expect(result.solved).toBe(false);
  });

  it('reports a run that stopped on an error or never ended', () => {
    const broke = check([set(3), { mnemonic: 'bad', operands: [] }]);
    expect(broke.error).toBe('It broke');
    expect(broke.solved).toBe(false);
    const loop = check([set(3), { mnemonic: 'jmp', operands: [{ type: 'label', value: 1 }] }]);
    expect(loop.error).not.toBeNull();
    expect(loop.goals[0].met).toBe(false);
  });

  it('runs a case from the CPU its setup left', () => {
    const fromSeven: Challenge<Toy, ToyState> = {
      ...QUADRUPLE,
      cases: [
        {
          given: [],
          setup: (state) => {
            state.value = 7;
          },
          met: [(state) => state.value === 28]
        }
      ]
    };
    expect(checkChallenge(TOY, fromSeven, [dbl, dbl]).solved).toBe(true);
    expect(checkChallenge(TOY, fromSeven, [set(28)]).limits[2].met).toBe(false);
  });

  it('leaves the CPU it was given untouched: every run starts fresh', () => {
    expect(check([set(3), dbl, dbl]).solved).toBe(true);
    expect(check([set(3), dbl, dbl]).solved).toBe(true);
  });
});
