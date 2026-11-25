import { describe, expect, it } from 'vitest';
import { execute } from './execute';
import { formatInstruction, type Instruction } from './instructions';
import type { Operand } from './operands';
import { expandPseudo, isValidPseudo, loadImmediate, type PseudoInstruction } from './pseudo';
import { parseRegister } from './registers';
import { createCpuState, readRegister } from './state';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const label = (target: number): Operand => ({ type: 'label', target });
const text = (instructions: Instruction[]) => instructions.map(formatInstruction);

/** Runs what LI expands to and returns the value it leaves in a0. */
function loaded(value: number): number {
  const cpu = createCpuState();
  for (const instruction of loadImmediate(10, value)) execute(cpu, instruction, null, []);
  return readRegister(cpu, 10);
}

describe('li', () => {
  it('is one ADDI when the value fits in 12 signed bits', () => {
    expect(text(loadImmediate(10, 5))).toEqual(['addi a0, zero, 5']);
    expect(text(loadImmediate(10, -2048))).toEqual(['addi a0, zero, -2048']);
  });

  it('is LUI then ADDI otherwise, with LUI one higher when the low part is negative', () => {
    expect(text(loadImmediate(10, 0x12345678))).toEqual(['lui a0, 0x12345', 'addi a0, a0, 0x678']);
    expect(text(loadImmediate(10, 0x12345fff))).toEqual(['lui a0, 0x12346', 'addi a0, a0, -1']);
    expect(text(loadImmediate(10, 0x800))).toEqual(['lui a0, 1', 'addi a0, a0, -2048']);
  });

  it('is LUI alone when the low 12 bits are 0', () => {
    expect(text(loadImmediate(10, 0x10000000))).toEqual(['lui a0, 0x10000']);
    expect(text(loadImmediate(10, -4096))).toEqual(['lui a0, 0xFFFFF']);
  });

  it('always leaves exactly the value asked for', () => {
    for (const value of [
      0, 1, 2047, 2048, 4095, 0x7ffff800, 0x7fffffff, 0x80000000, 0xffffffff, 0xdeadbeef
    ]) {
      expect(loaded(value)).toBe(value >>> 0);
    }
  });
});

describe('the other pseudo-instructions', () => {
  const expanded = (pseudo: PseudoInstruction) => text(expandPseudo(pseudo));

  it('become one real instruction each', () => {
    expect(expanded({ mnemonic: 'mv', operands: [r('a0'), r('a1')] })).toEqual(['addi a0, a1, 0']);
    expect(expanded({ mnemonic: 'not', operands: [r('a0'), r('a1')] })).toEqual([
      'xori a0, a1, -1'
    ]);
    expect(expanded({ mnemonic: 'neg', operands: [r('a0'), r('a1')] })).toEqual([
      'sub a0, zero, a1'
    ]);
    expect(expanded({ mnemonic: 'nop', operands: [] })).toEqual(['addi zero, zero, 0']);
    expect(expanded({ mnemonic: 'j', operands: [label(3)] })).toEqual(['jal zero, L3']);
    expect(expanded({ mnemonic: 'ret', operands: [] })).toEqual(['jalr zero, 0(ra)']);
    expect(expanded({ mnemonic: 'beqz', operands: [r('t0'), label(1)] })).toEqual([
      'beq t0, zero, L1'
    ]);
    expect(expanded({ mnemonic: 'bgtz', operands: [r('t0'), label(1)] })).toEqual([
      'blt zero, t0, L1'
    ]);
  });

  it('swap the registers of a branch the hardware does not have', () => {
    expect(expanded({ mnemonic: 'bgt', operands: [r('a0'), r('a1'), label(2)] })).toEqual([
      'blt a1, a0, L2'
    ]);
    expect(expanded({ mnemonic: 'bleu', operands: [r('a0'), r('a1'), label(2)] })).toEqual([
      'bgeu a1, a0, L2'
    ]);
  });

  it('accept any 32-bit value for LI, and nothing more', () => {
    const li = (value: number): PseudoInstruction => ({
      mnemonic: 'li',
      operands: [r('a0'), { type: 'imm', value }]
    });
    expect(isValidPseudo(li(0xffffffff))).toBe(true);
    expect(isValidPseudo(li(-(2 ** 31)))).toBe(true);
    expect(isValidPseudo(li(2 ** 32))).toBe(false);
  });
});
