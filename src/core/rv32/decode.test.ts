import { describe, expect, it } from 'vitest';
import { decode } from './decode';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import { parseRegister } from './registers';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const at = (offset: number, base: string): Operand => ({
  type: 'mem',
  base: parseRegister(base)!,
  offset
});
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

describe('decode', () => {
  it('reads two registers and writes one for an R-type instruction', () => {
    const decoded = decode(line('add', r('a0'), r('a1'), r('a2')));
    expect(decoded).toMatchObject({
      format: 'R',
      rd: 10,
      rs1: 11,
      rs2: 12,
      immediate: null,
      reads: [11, 12],
      writes: [10],
      alu: { a: 'rs1', b: 'rs2' },
      memory: null,
      nextPc: 'next',
      writeBack: 'alu'
    });
  });

  it('sign-extends the immediate and feeds it to the ALU', () => {
    const decoded = decode(line('addi', r('a0'), r('a0'), imm(-1)));
    expect(decoded.immediate).toBe(0xffffffff);
    expect(decoded.alu).toEqual({ a: 'rs1', b: 'immediate' });
  });

  it('adds base and offset in the ALU for loads and stores', () => {
    expect(decode(line('lw', r('a0'), at(8, 'sp')))).toMatchObject({
      rs1: 2,
      immediate: 8,
      memory: { access: 'load', size: 4 },
      writeBack: 'memory'
    });
    expect(decode(line('sb', r('t0'), at(-1, 's0')))).toMatchObject({
      rd: null,
      rs1: 8,
      rs2: 5,
      reads: [8, 5],
      writes: [],
      memory: { access: 'store', size: 1 },
      writeBack: null
    });
  });

  it('never lists x0 as written', () => {
    expect(decode(line('jal', r('zero'), label(3))).writes).toEqual([]);
  });

  it('tells branches, jumps and upper immediates apart', () => {
    expect(decode(line('beq', r('a0'), r('zero'), label(1)))).toMatchObject({
      reads: [10, 0],
      alu: null,
      nextPc: 'branch'
    });
    expect(decode(line('jalr', r('ra'), at(0, 'a0')))).toMatchObject({
      alu: { a: 'rs1', b: 'immediate' },
      nextPc: 'jump',
      writeBack: 'link'
    });
    expect(decode(line('lui', r('a0'), imm(0x12345)))).toMatchObject({
      immediate: 0x12345000,
      alu: null,
      writeBack: 'immediate'
    });
    expect(decode(line('auipc', r('a0'), imm(1))).alu).toEqual({ a: 'pc', b: 'immediate' });
  });
});
