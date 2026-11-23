import { describe, expect, it } from 'vitest';
import { CpuError } from '@/core/shared/cpuError';
import { isFinished, step } from '@/core/shared/program';
import { RV32 } from '@/core/rv32/architecture';
import { execute } from '@/core/rv32/execute';
import type { Instruction, Mnemonic } from '@/core/rv32/instructions';
import type { Operand } from '@/core/rv32/operands';
import { parseRegister } from '@/core/rv32/registers';
import { addressOfLine, createCpuState, DATA_BASE, readRegister } from '@/core/rv32/state';
import { grade, type Answer } from './prediction';
import { rv32Predictor as predictor } from './rv32Prediction';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const at = (offset: number, base: string): Operand => ({
  type: 'mem',
  base: parseRegister(base)!,
  offset
});
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** Runs `instruction` after `setup`, and grades `answer` to its question. */
function ask(instruction: Instruction, answer: Answer, ...setup: Instruction[]) {
  const state = createCpuState();
  const program = [...setup, instruction];
  setup.forEach((earlier, index) => execute(state, earlier, index, program));
  const question = predictor.question(instruction)!;
  const record = execute(state, instruction, setup.length, program);
  const truth = predictor.truth(question, record, state);
  const why = predictor.why(question, record, state, []);
  return grade(question, answer, truth, why, predictor.formatValue);
}

describe('the question', () => {
  it('asks a branch whether it is taken', () => {
    expect(predictor.question(line('blt', r('a0'), r('a1'), label(0)))?.kind).toBe('branch');
  });

  it('asks for the register an instruction writes', () => {
    expect(predictor.question(line('addi', r('a0'), r('a0'), imm(1)))).toMatchObject({
      kind: 'value',
      register: 'a0',
      bits: 32
    });
    expect(predictor.question(line('lw', r('t0'), at(0, 'sp')))?.kind).toBe('value');
  });

  it('asks nothing of a store, a jump or a write to zero', () => {
    for (const instruction of [
      line('sw', r('a0'), at(0, 'sp')),
      line('jal', r('ra'), label(0)),
      line('jalr', r('zero'), r('ra'), imm(0)),
      line('addi', r('zero'), r('zero'), imm(0))
    ]) {
      expect(predictor.question(instruction)).toBeNull();
    }
  });
});

describe('the answer', () => {
  it('is checked against the register, with the sum that made it', () => {
    const outcome = ask(
      line('addi', r('a0'), r('a0'), imm(-1)),
      { kind: 'value', value: 0xffffffff },
      line('addi', r('a0'), r('zero'), imm(0))
    );
    expect(outcome).toMatchObject({ correct: true, actual: 'a0 is 0xFFFFFFFF' });
    expect(outcome.why).toBe('0x00000000 + 0xFFFFFFFF = 0xFFFFFFFF.');
  });

  it('explains a loaded value by where it came from', () => {
    const outcome = ask(
      line('lw', r('t1'), at(0, 't0')),
      { kind: 'value', value: 7 },
      line('lui', r('t0'), imm(DATA_BASE >>> 12)),
      line('addi', r('a0'), r('zero'), imm(7)),
      line('sw', r('a0'), at(0, 't0'))
    );
    expect(outcome.correct).toBe(true);
    expect(outcome.why).toMatch(/^Loaded the word 0x00000007 from /);
  });

  it('knows a signed branch from an unsigned one', () => {
    const minus = line('addi', r('a0'), r('zero'), imm(-1));
    const signed = ask(
      line('blt', r('a0'), r('zero'), label(0)),
      { kind: 'branch', taken: true },
      minus
    );
    expect(signed.correct).toBe(true);
    expect(signed.why).toMatch(/^Taken: BLT/);
    const unsigned = line('bltu', r('a0'), r('zero'), label(0));
    expect(ask(unsigned, { kind: 'branch', taken: true }, minus).correct).toBe(false);
  });
});

describe('on every example program', () => {
  it.each(RV32.examples.map((example) => [example.name, example.program] as const))(
    '%s: the truth is what the CPU did',
    (_, program) => {
      const state = RV32.createState();
      for (let steps = 0; steps < 400 && !isFinished(RV32, state, program); steps++) {
        const instruction = program[RV32.nextLine(state, program)];
        const question = predictor.question(instruction);
        let record;
        try {
          record = step(RV32, state, program);
        } catch (error) {
          if (error instanceof CpuError) break;
          throw error;
        }
        if (!question) continue;
        const truth = predictor.truth(question, record, state);
        expect(truth.kind).toBe(question.kind);
        if (truth.kind === 'value' && question.kind === 'value') {
          expect(truth.value).toBe(readRegister(state, parseRegister(question.register)!));
        }
        if (truth.kind === 'branch') {
          expect(truth.taken).toBe(state.registers.pc !== addressOfLine(record.line! + 1));
        }
        const why = predictor.why(question, record, state, []);
        expect(why).not.toBeNull();
        expect(grade(question, truth, truth, why, predictor.formatValue).correct).toBe(true);
      }
    }
  );
});
