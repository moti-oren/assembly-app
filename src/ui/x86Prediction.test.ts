import { describe, expect, it } from 'vitest';
import { CpuError } from '@/core/shared/cpuError';
import { isFinished, step } from '@/core/shared/program';
import { X86 } from '@/core/x86/architecture';
import { execute } from '@/core/x86/execute';
import type { Instruction, Mnemonic } from '@/core/x86/instructions';
import type { Operand } from '@/core/x86/operands';
import type { RegisterName } from '@/core/x86/registers';
import { createCpuState, readRegister, writeRegister } from '@/core/x86/state';
import { grade, wrongFlags, type Answer } from './prediction';
import { x86Predictor as predictor } from './x86Prediction';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const mem: Operand = { type: 'mem', size: 16, base: 'bx', displacement: 0 };
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** Runs `instruction` after `setup`, and grades `answer` to its question. */
function ask(instruction: Instruction, answer: Answer, ...setup: Instruction[]) {
  const state = createCpuState();
  for (const earlier of setup) execute(state, earlier);
  const question = predictor.question(instruction)!;
  const record = execute(state, instruction, 0);
  const truth = predictor.truth(question, record, state);
  const why = predictor.why(question, record, state, wrongFlags(question, answer, truth));
  return grade(question, answer, truth, why, predictor.formatValue);
}

describe('the question', () => {
  it('asks a conditional jump whether it jumps', () => {
    expect(predictor.question(line('jge', label(3)))).toEqual({ kind: 'branch', text: 'jge L3' });
    expect(predictor.question(line('loop', label(0)))?.kind).toBe('branch');
  });

  it('asks for the register an instruction writes, at its size', () => {
    expect(predictor.question(line('add', reg('al'), imm(1)))).toMatchObject({
      kind: 'value',
      register: 'AL',
      bits: 8
    });
    expect(predictor.question(line('shl', reg('bx'), imm(1)))).toMatchObject({ bits: 16 });
  });

  it('asks a comparison for its flags', () => {
    expect(predictor.question(line('cmp', reg('ax'), imm(1)))).toMatchObject({
      kind: 'flags',
      flags: ['CF', 'ZF', 'SF', 'OF']
    });
    expect(predictor.question(line('test', reg('ax'), reg('ax')))?.kind).toBe('flags');
  });

  it('asks nothing of what the first version leaves out', () => {
    for (const instruction of [
      line('jmp', label(2)),
      line('push', reg('ax')),
      line('mov', mem, reg('ax')),
      line('add', mem, imm(1)),
      line('mul', reg('bx')),
      line('xchg', reg('ax'), reg('bx')),
      line('nop'),
      line('ret')
    ]) {
      expect(predictor.question(instruction)).toBeNull();
    }
  });
});

describe('the answer', () => {
  it('is checked against the register after the instruction', () => {
    const add = line('add', reg('ax'), imm(3));
    const right = ask(add, { kind: 'value', value: 8 }, line('mov', reg('ax'), imm(5)));
    expect(right).toMatchObject({
      correct: true,
      actual: 'AX is 0008',
      why: '0005 + 0003 = 0008.'
    });
    expect(ask(add, { kind: 'value', value: 7 }).correct).toBe(false);
  });

  it('reads a byte register as its byte', () => {
    const outcome = ask(
      line('add', reg('ah'), imm(1)),
      { kind: 'value', value: 0x13 },
      line('mov', reg('ax'), imm(0x1234))
    );
    expect(outcome).toMatchObject({ correct: true, actual: 'AH is 13' });
  });

  it('explains the flags that were wrong', () => {
    const cmp = line('cmp', reg('ax'), imm(5));
    const setup = line('mov', reg('ax'), imm(5));
    expect(ask(cmp, { kind: 'flags', on: ['ZF'] }, setup).correct).toBe(true);
    const wrong = ask(cmp, { kind: 'flags', on: ['CF', 'ZF'] }, setup);
    expect(wrong.correct).toBe(false);
    expect(wrong.why).toMatch(/^CF: /);
    expect(wrong.why).not.toMatch(/ZF: /);
  });

  it('knows a LOOP tests CX after counting it down', () => {
    const loop = line('loop', label(4));
    const one = line('mov', reg('cx'), imm(1));
    expect(ask(loop, { kind: 'branch', taken: false }, one).correct).toBe(true);
    const two = line('mov', reg('cx'), imm(2));
    const taken = ask(loop, { kind: 'branch', taken: true }, two);
    expect(taken.correct).toBe(true);
    expect(taken.why).toMatch(/^Taken: LOOP/);
  });
});

describe('on every example program', () => {
  it.each(X86.examples.map((example) => [example.name, example.program] as const))(
    '%s: the truth is what the CPU did',
    (_, program) => {
      const state = X86.createState();
      for (let steps = 0; steps < 400 && !isFinished(X86, state, program); steps++) {
        const instruction = program[X86.nextLine(state, program)];
        const question = predictor.question(instruction);
        let record;
        try {
          record = step(X86, state, program);
        } catch (error) {
          if (error instanceof CpuError) break;
          throw error;
        }
        if (!question) continue;
        const truth = predictor.truth(question, record, state);
        expect(truth.kind).toBe(question.kind);
        if (truth.kind === 'value' && question.kind === 'value') {
          expect(truth.value).toBe(readRegister(state, question.key as RegisterName));
        }
        if (truth.kind === 'branch') {
          expect(truth.taken).toBe(state.registers.ip !== record.line! + 1);
        }
        const why = predictor.why(question, record, state, []);
        expect(grade(question, truth, truth, why, predictor.formatValue).correct).toBe(true);
      }
    }
  );

  it('keeps the register it asks for', () => {
    const state = createCpuState();
    writeRegister(state, 'bx', 0x1234);
    const question = predictor.question(line('mov', reg('ax'), reg('bx')))!;
    const record = execute(state, line('mov', reg('ax'), reg('bx')));
    expect(predictor.truth(question, record, state)).toEqual({ kind: 'value', value: 0x1234 });
  });
});
