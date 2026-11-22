import { beforeEach, describe, expect, it } from 'vitest';
import { CpuError } from './cpuError';
import type { ExecutionRecord } from './executionRecord';
import {
  insertLine,
  isFinished,
  lineAfterInsert,
  lineAfterMove,
  lineAfterRemove,
  lineAfterReplace,
  MAX_STEPS,
  moveLine,
  removeLine,
  replaceLine,
  runToEnd,
  step,
  tooManySteps,
  type LabelOperand,
  type LineRunner,
  type Program
} from './program';

/** A toy CPU, just enough to run programs: it counts, jumps, writes memory and fails. */
interface Toy {
  op: 'inc' | 'jump' | 'write' | 'fail';
  operands: (LabelOperand | { type: 'count'; value: number })[];
}

interface ToyState {
  next: number;
  total: number;
}

const toy: LineRunner<Toy, ToyState, ExecutionRecord<Toy>> = {
  nextLine: (state) => state.next,
  execute(state, instruction, line) {
    if (instruction.op === 'fail') throw new CpuError('Toy failure');
    if (line !== null) state.next = line + 1;
    const [operand] = instruction.operands;
    if (instruction.op === 'jump' && operand?.type === 'label') state.next = operand.target;
    if (instruction.op === 'inc') state.total++;
    const writes = instruction.op === 'write' && operand?.type === 'count' ? operand.value : 0;
    return {
      instruction,
      line,
      before: { registers: {}, flags: 0 },
      memoryWrites: Array.from({ length: writes }, (_, address) => ({
        address,
        before: 0,
        after: 1
      })),
      portWrites: [],
      registersWritten: []
    };
  }
};

const label = (target: number): LabelOperand => ({ type: 'label', target });
const inc: Toy = { op: 'inc', operands: [] };
const jump = (target: number): Toy => ({ op: 'jump', operands: [label(target)] });
const write = (value: number): Toy => ({ op: 'write', operands: [{ type: 'count', value }] });
const fail: Toy = { op: 'fail', operands: [] };

let state: ToyState;

beforeEach(() => {
  state = { next: 0, total: 0 };
});

describe('stepping', () => {
  it('runs the line at the instruction pointer and stops at the end', () => {
    const program: Program<Toy> = [inc, inc];
    expect(step(toy, state, program).line).toBe(0);
    expect(step(toy, state, program).line).toBe(1);
    expect(state.total).toBe(2);
    expect(isFinished(toy, state, program)).toBe(true);
    expect(() => step(toy, state, program)).toThrow(CpuError);
  });
});

describe('runToEnd', () => {
  it('runs every line', () => {
    const result = runToEnd(toy, state, [inc, jump(3), inc, inc]);
    expect(result.error).toBeNull();
    expect(result.records.map((record) => record.line)).toEqual([0, 1, 3]);
    expect(state.total).toBe(2);
  });

  it('stops endless loops', () => {
    const result = runToEnd(toy, state, [jump(0)], 50);
    expect(result.records.length).toBe(50);
    expect(result.error?.message).toContain('50 steps');
  });

  it('stops a loop that writes too much memory, long before the step limit', () => {
    const result = runToEnd(toy, state, [write(100), jump(0)], 1000, 250);
    // Three writes of 100 bytes pass the limit of 250; the run stops before the next step.
    expect(result.records.length).toBe(5);
    expect(result.records.reduce((sum, record) => sum + record.memoryWrites.length, 0)).toBe(300);
    expect(result.error?.message).toContain('250 memory writes');
  });

  it('names the step limit a timed run shares with it', () => {
    expect(tooManySteps().message).toContain(`${MAX_STEPS} steps`);
  });

  it('stops at the first error and keeps what ran before it', () => {
    const result = runToEnd(toy, state, [inc, fail, inc]);
    expect(result.records.length).toBe(1);
    expect(result.error?.message).toBe('Toy failure');
    expect(state.next).toBe(1);
  });
});

describe('editing a program', () => {
  const program: Program<Toy> = [inc, inc, jump(1), jump(4)]; // L4 = the end of the program

  it('inserting keeps jumps on the same instructions', () => {
    const edited = insertLine(program, 1, fail);
    expect(edited[1]).toBe(fail);
    expect(edited[3].operands[0]).toEqual(label(2)); // still points at the second inc
    expect(edited[4].operands[0]).toEqual(label(5)); // still the end
  });

  it('labels in the inserted line refer to the program before the insert', () => {
    // "jump L1" inserted above line 1 means "jump to the second inc", which moves to line 2.
    const edited = insertLine(program, 1, jump(1));
    expect(edited[1].operands[0]).toEqual(label(2));
    expect(edited[2]).toBe(inc);
  });

  it('removing a line moves jumps to the line that replaced it', () => {
    const edited = removeLine(program, 1);
    expect(edited.length).toBe(3);
    expect(edited[1].operands[0]).toEqual(label(1)); // now the jump itself
    expect(edited[2].operands[0]).toEqual(label(3)); // still the end
  });

  it('replacing a line leaves every jump where it pointed', () => {
    const edited = replaceLine(program, 1, [fail]);
    expect(edited).toEqual([inc, fail, jump(1), jump(4)]);
  });

  it('replacing a line with two shifts the jumps past it', () => {
    // The new lines' labels refer to the program before the edit: L4 was the end.
    const edited = replaceLine(program, 1, [fail, jump(4)]);
    expect(edited.length).toBe(5);
    expect(edited[2].operands[0]).toEqual(label(5));
    expect(edited[3].operands[0]).toEqual(label(1)); // the first of the new lines
    expect(edited[4].operands[0]).toEqual(label(5)); // still the end
    expect(lineAfterReplace(2, 1, 2)).toBe(3);
    expect(lineAfterReplace(1, 1, 2)).toBe(1);
    expect(lineAfterReplace(4, 1, 2)).toBe(5); // a finished program stays finished
  });

  it('replaces the last line, and lets a new line point at the line it replaces', () => {
    const edited = replaceLine(program, 3, [jump(3), inc]);
    expect(edited.length).toBe(5);
    expect(edited[3].operands[0]).toEqual(label(3)); // the first of the new lines
    expect(edited[4]).toBe(inc);
  });

  it('moving a line takes the jumps that pointed at it along', () => {
    const down = moveLine(program, 1, 2); // inc, jump, inc, jump
    expect(down[2]).toBe(inc);
    expect(down[1].operands[0]).toEqual(label(2)); // follows the second inc
    expect(down[3].operands[0]).toEqual(label(4)); // still the end
    const up = moveLine(program, 2, 0); // jump, inc, inc, jump
    expect(up[0].operands[0]).toEqual(label(2)); // the second inc moved down one
    expect(moveLine(moveLine(program, 0, 3), 3, 0)).toEqual(program);
  });

  it('says where each line went after a move', () => {
    expect([0, 1, 2, 3, 4].map((line) => lineAfterMove(line, 1, 3))).toEqual([0, 3, 1, 2, 4]);
    expect([0, 1, 2, 3, 4].map((line) => lineAfterMove(line, 3, 1))).toEqual([0, 2, 3, 1, 4]);
  });

  it('keeps the instruction pointer on the same instruction', () => {
    expect(lineAfterInsert(2, 1)).toBe(3);
    expect(lineAfterInsert(4, 4)).toBe(4); // inserted at the next line: the new line runs next
    expect(lineAfterRemove(3, 1)).toBe(2);
    expect(lineAfterRemove(1, 1)).toBe(1);
  });
});
