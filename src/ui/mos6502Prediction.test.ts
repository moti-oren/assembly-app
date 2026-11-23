import { describe, expect, it } from 'vitest';
import { CpuError } from '@/core/shared/cpuError';
import { isFinished, step } from '@/core/shared/program';
import { MOS6502 } from '@/core/mos6502/architecture';
import { execute } from '@/core/mos6502/execute';
import type { Instruction, Mnemonic } from '@/core/mos6502/instructions';
import { addressOfLine } from '@/core/mos6502/layout';
import type { Operand } from '@/core/mos6502/operands';
import { createCpuState, type RegisterName } from '@/core/mos6502/state';
import { mos6502Predictor as predictor } from './mos6502Prediction';
import { grade, wrongFlags, type Answer } from './prediction';

const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const imm = (value: number): Operand => ({ type: 'imm', value });
const zp = (address: number): Operand => ({ type: 'zp', address, index: null });
const label = (target: number): Operand => ({ type: 'label', target });

/** Runs `instruction` after `setup`, and grades `answer` to its question. */
function ask(instruction: Instruction, answer: Answer, ...setup: Instruction[]) {
  const state = createCpuState();
  const program = [...setup, instruction];
  setup.forEach((earlier, index) => execute(state, earlier, index, program));
  const question = predictor.question(instruction)!;
  const record = execute(state, instruction, setup.length, program);
  const truth = predictor.truth(question, record, state);
  const why = predictor.why(question, record, state, wrongFlags(question, answer, truth));
  return grade(question, answer, truth, why, predictor.formatValue);
}

describe('the question', () => {
  it('asks a branch whether it is taken', () => {
    expect(predictor.question(line('bne', label(0)))).toEqual({ kind: 'branch', text: 'bne L0' });
  });

  it('asks for the register an instruction writes, not the stack pointer', () => {
    expect(predictor.question(line('adc', imm(1)))).toMatchObject({ register: 'A', bits: 8 });
    expect(predictor.question(line('inx'))).toMatchObject({ register: 'X' });
    expect(predictor.question(line('pla'))).toMatchObject({ register: 'A' });
    expect(predictor.question(line('asl', { type: 'acc' }))).toMatchObject({ register: 'A' });
  });

  it('asks a comparison for the flags it sets', () => {
    expect(predictor.question(line('cmp', imm(1)))).toMatchObject({
      kind: 'flags',
      flags: ['N', 'Z', 'C']
    });
    expect(predictor.question(line('bit', zp(0x10)))).toMatchObject({ flags: ['N', 'V', 'Z'] });
  });

  it('asks nothing of what the first version leaves out', () => {
    for (const instruction of [
      line('sta', zp(0x10)),
      line('inc', zp(0x10)),
      line('jmp', label(0)),
      line('jsr', label(0)),
      line('txs'),
      line('pha'),
      line('clc'),
      line('nop')
    ]) {
      expect(predictor.question(instruction)).toBeNull();
    }
  });
});

describe('the answer', () => {
  it('is checked against the register, with the sum that made it', () => {
    const outcome = ask(
      line('adc', imm(0x01)),
      { kind: 'value', value: 0x1b },
      line('sec'),
      line('lda', imm(0x19))
    );
    expect(outcome).toMatchObject({
      correct: true,
      actual: 'A is $1B',
      why: '$19 + $01 + 1 (C) = $1B.'
    });
  });

  it('explains a loaded value by where it came from', () => {
    const outcome = ask(
      line('ldx', zp(0x10)),
      { kind: 'value', value: 0 },
      line('lda', imm(7)),
      line('sta', zp(0x10))
    );
    expect(outcome).toMatchObject({ correct: false, actual: 'X is $07', said: '$00' });
    expect(outcome.why).toBe('Read $07 from $0010.');
  });

  it('explains the flags that were wrong', () => {
    const cmp = line('cmp', imm(3));
    const setup = line('lda', imm(5));
    expect(ask(cmp, { kind: 'flags', on: ['C'] }, setup).correct).toBe(true);
    const wrong = ask(cmp, { kind: 'flags', on: [] }, setup);
    expect(wrong.correct).toBe(false);
    expect(wrong.why).toBe('C: $05 ≥ $03 (unsigned).');
  });

  it('says why a branch went the way it did', () => {
    const taken = ask(line('beq', label(0)), { kind: 'branch', taken: true }, line('lda', imm(0)));
    expect(taken.correct).toBe(true);
    expect(taken.why).toMatch(/^Taken: BEQ/);
  });
});

describe('on every example program', () => {
  it.each(MOS6502.examples.map((example) => [example.name, example.program] as const))(
    '%s: the truth is what the CPU did',
    (_, program) => {
      const state = MOS6502.createState();
      for (let steps = 0; steps < 400 && !isFinished(MOS6502, state, program); steps++) {
        const instruction = program[MOS6502.nextLine(state, program)];
        const question = predictor.question(instruction);
        let record;
        try {
          record = step(MOS6502, state, program);
        } catch (error) {
          if (error instanceof CpuError) break;
          throw error;
        }
        if (!question) continue;
        const truth = predictor.truth(question, record, state);
        expect(truth.kind).toBe(question.kind);
        if (truth.kind === 'value' && question.kind === 'value') {
          expect(truth.value).toBe(state.registers[question.key as RegisterName]);
        }
        if (truth.kind === 'branch') {
          expect(truth.taken).toBe(state.registers.pc !== addressOfLine(program, record.line! + 1));
        }
        const why = predictor.why(question, record, state, []);
        expect(grade(question, truth, truth, why, predictor.formatValue).correct).toBe(true);
      }
    }
  );
});
