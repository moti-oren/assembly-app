import { describe, expect, it } from 'vitest';
import { execute as run6502 } from '@/core/mos6502/execute';
import type {
  Instruction as Line6502,
  Mnemonic as Mnemonic6502
} from '@/core/mos6502/instructions';
import { createCpuState as create6502, setFlag as setFlag6502 } from '@/core/mos6502/state';
import { mos6502NumberLink } from '@/core/mos6502NumberLink';
import { hasNumbers } from '@/core/numberLink';
import type { ArithmeticRequest } from '@/core/representation/arithmetic';
import { execute as runX86 } from '@/core/x86/execute';
import type { Instruction as LineX86, Mnemonic as MnemonicX86 } from '@/core/x86/instructions';
import type { Operand as OperandX86 } from '@/core/x86/operands';
import { createCpuState as createX86, setFlag as setFlagX86 } from '@/core/x86/state';
import { x86NumberLink } from '@/core/x86NumberLink';
import { solveArithmetic } from '@/core/representation/arithmetic';
import {
  compareRows,
  compareSummary,
  compareWarning,
  differenceFlags,
  isComparison
} from './numbersCompare';
import { CONDITION_SETS } from './numbersConditions';
import { freeView } from './numbersView';

const difference = (a: number, b: number, width: 8 | 16 | 32 = 8) =>
  solveArithmetic({ kind: 'subtract', width, a, b, extra: 0 });

const rowOf = (set: keyof typeof CONDITION_SETS, mnemonic: string, a: number, b: number) =>
  compareRows(CONDITION_SETS[set], difference(a, b)).find((row) => row.mnemonic === mnemonic)!;

describe('isComparison', () => {
  it('is a difference with nothing more taken off', () => {
    const free = (kind: 'add' | 'subtract', extra: 0 | 1) =>
      freeView({ kind, width: 8, a: 1, b: 2, extra });
    expect(isComparison(free('subtract', 0))).toBe(true);
    expect(isComparison(free('subtract', 1))).toBe(false);
    expect(isComparison(free('add', 0))).toBe(false);
  });

  it('is not one where a flag the jumps read was left as it was', () => {
    const view = freeView({ kind: 'subtract', width: 8, a: 1, b: 2, extra: 0 });
    expect(isComparison({ ...view, comparable: false })).toBe(false);
  });
});

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

describe('after a real instruction', () => {
  const ax: OperandX86 = { type: 'reg', name: 'ax' };
  const bx: OperandX86 = { type: 'reg', name: 'bx' };

  /** The 8086 with the instruction run on it, from registers and a carry the seed picks. */
  function x86After(instruction: LineX86, next: () => number) {
    const values = [next() & 0xffff, next() % 3 === 0 ? 1 : next() & 0xffff, next() % 2 === 1];
    const make = () => {
      const cpu = createX86();
      cpu.registers.ax = values[0] as number;
      cpu.registers.bx = values[1] as number;
      setFlagX86(cpu, 'CF', values[2] as boolean);
      return { cpu, record: runX86(cpu, instruction, 0) };
    };
    return make;
  }

  it.each([
    ['sub', [ax, bx]],
    ['cmp', [ax, bx]],
    ['sbb', [ax, bx]],
    ['neg', [ax]]
  ] as const)('8086 %s: every jump on show goes as the CPU’s does', (mnemonic, operands) => {
    const next = random(mnemonic.charCodeAt(0) * 97 + mnemonic.charCodeAt(2));
    let shown = 0;
    for (let i = 0; i < 120; i++) {
      const make = x86After({ mnemonic, operands: [...operands] }, next);
      const link = x86NumberLink(make().record);
      if (!hasNumbers(link)) throw new Error(link.unavailable);
      if (!isComparison(link)) continue;
      shown++;
      const solution = solveArithmetic(link.request as ArithmeticRequest);
      for (const row of compareRows(CONDITION_SETS.x86, solution)) {
        const { cpu } = make();
        const jump = row.mnemonic.toLowerCase() as MnemonicX86;
        runX86(cpu, { mnemonic: jump, operands: [{ type: 'label', target: 5 }] }, 0);
        expect(row.taken, `${mnemonic} then ${jump}`).toBe(cpu.registers.ip === 5);
      }
    }
    expect(shown).toBeGreaterThan(0);
  });

  it.each(['inc', 'dec'] as const)('8086 %s keeps CF, so it has no jumps to show', (mnemonic) => {
    const cpu = createX86();
    const link = x86NumberLink(runX86(cpu, { mnemonic, operands: [ax] }, 0));
    expect(hasNumbers(link) && isComparison(link)).toBe(false);
  });

  /** The 6502 with the instruction run as line 0 of a program that branches next. */
  function mos6502After(instruction: Line6502, branch: Mnemonic6502, values: number[]) {
    const cpu = create6502();
    [cpu.registers.a, cpu.registers.x, cpu.registers.y] = values;
    setFlag6502(cpu, 'C', values[3] === 1);
    const program: Line6502[] = [
      instruction,
      { mnemonic: branch, operands: [{ type: 'label', target: 0 }] }
    ];
    const record = run6502(cpu, program[0], 0, program);
    return { cpu, record, program };
  }

  it.each(['cmp', 'cpx', 'cpy', 'sbc'] as const)(
    '6502 %s: every branch on show goes as the CPU’s does',
    (mnemonic) => {
      const next = random(mnemonic.charCodeAt(1) * 211 + mnemonic.charCodeAt(2));
      let shown = 0;
      for (let i = 0; i < 200; i++) {
        const values = [next() & 0xff, next() & 0xff, next() & 0xff, next() % 2];
        const line: Line6502 = { mnemonic, operands: [{ type: 'imm', value: next() & 0xff }] };
        const link = mos6502NumberLink(mos6502After(line, 'beq', values).record);
        if (!hasNumbers(link)) throw new Error(link.unavailable);
        if (!isComparison(link)) continue;
        shown++;
        const solution = solveArithmetic(link.request as ArithmeticRequest);
        for (const row of compareRows(CONDITION_SETS.mos6502, solution)) {
          const branch = row.mnemonic.toLowerCase() as Mnemonic6502;
          const { cpu, program } = mos6502After(line, branch, values);
          const taken = run6502(cpu, program[1], 1, program).branch!.taken;
          expect(row.taken, `${mnemonic} then ${branch}`).toBe(taken);
        }
      }
      expect(shown).toBeGreaterThan(0);
    }
  );

  it.each(['dex', 'dey', 'inx'] as const)(
    '6502 %s keeps C, so it has no branches to show',
    (mnemonic) => {
      const { record } = mos6502After({ mnemonic, operands: [] }, 'beq', [1, 5, 5, 0]);
      const link = mos6502NumberLink(record);
      expect(hasNumbers(link) && isComparison(link)).toBe(false);
    }
  );
});

describe('differenceFlags', () => {
  it('reads each flag from the numbers', () => {
    expect(differenceFlags(difference(1, 2))).toEqual({
      borrow: true,
      overflow: false,
      zero: false,
      negative: true
    });
    expect(differenceFlags(difference(0x80, 0x01))).toEqual({
      borrow: false,
      overflow: true,
      zero: false,
      negative: false
    });
    expect(differenceFlags(difference(7, 7)).zero).toBe(true);
  });
});

describe('compareRows', () => {
  it('puts the numbers of the jump’s own scale into its question', () => {
    expect(rowOf('x86', 'JA', 0xff, 0x01)).toMatchObject({
      asks: 'A > B, unsigned',
      numbers: '255 > 1',
      truth: true,
      when: 'CF = 0 and ZF = 0',
      taken: true,
      outcome: 'jumps',
      wrong: false
    });
    expect(rowOf('x86', 'JG', 0xff, 0x01)).toMatchObject({
      asks: 'A > B, signed',
      numbers: '−1 > 1',
      truth: false,
      taken: false,
      outcome: 'goes on'
    });
  });

  it('names no scale where the question is the same on both', () => {
    expect(rowOf('rv32', 'BEQ', 4, 4)).toMatchObject({ asks: 'A = B', numbers: '4 = 4' });
  });

  it('marks a 6502 branch on N that goes against the numbers', () => {
    // −128 is less than 1, but −128 − 1 does not fit and the difference reads +127.
    expect(rowOf('mos6502', 'BMI', 0x80, 0x01)).toMatchObject({
      truth: true,
      taken: false,
      wrong: true
    });
    expect(rowOf('mos6502', 'BMI', 0x01, 0x02).wrong).toBe(false);
    expect(rowOf('mos6502', 'BMI', 0x01, 0x02).caveat).not.toBeNull();
  });

  it('lists the jumps in the set’s order', () => {
    const rows = compareRows(CONDITION_SETS.rv32, difference(1, 2));
    expect(rows.map((row) => row.mnemonic)).toEqual(['BEQ', 'BNE', 'BLTU', 'BGEU', 'BLT', 'BGE']);
  });
});

describe('compareSummary', () => {
  it('says when the scales put the numbers in opposite orders', () => {
    const summary = compareSummary(difference(0xff, 0x01));
    expect(summary.split).toBe(true);
    expect(summary.text).toContain('unsigned, 255 is greater than 1');
    expect(summary.text).toContain('signed, −1 is less than 1');
  });

  it('says when they agree', () => {
    expect(compareSummary(difference(5, 3))).toMatchObject({ split: false });
    expect(compareSummary(difference(5, 3)).text).toContain('A is greater than B');
    expect(compareSummary(difference(9, 9)).text).toContain('A equals B');
  });
});

describe('compareWarning', () => {
  const rows = (set: keyof typeof CONDITION_SETS, a: number, b: number) =>
    compareRows(CONDITION_SETS[set], difference(a, b));

  it('is nothing where every jump answers its question', () => {
    expect(compareWarning(rows('x86', 0x80, 0x01))).toBeNull();
    expect(compareWarning(rows('rv32', 0x80, 0x01))).toBeNull();
  });

  it('says when a branch on N is wrong for the numbers on show', () => {
    expect(compareWarning(rows('mos6502', 0x01, 0x02))).toMatchObject({ wrong: false });
    expect(compareWarning(rows('mos6502', 0x80, 0x01))).toMatchObject({ wrong: true });
  });
});
