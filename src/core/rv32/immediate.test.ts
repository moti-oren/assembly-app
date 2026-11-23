import { describe, expect, it } from 'vitest';
import { u32 } from './bits';
import { encodeAt } from './encode';
import { immediateOf } from './immediate';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';

const r = (index: number): Operand => ({ type: 'reg', index });
const imm = (value: number): Operand => ({ type: 'imm', value });
const mem = (base: number, offset: number): Operand => ({ type: 'mem', base, offset });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

const word = (instruction: Instruction, address = 0) => encodeAt(instruction, address).word;

describe('immediateOf', () => {
  it.each([0, 1, 5, 2047, -1, -2048, -77])('reads the I immediate %i back', (value) => {
    expect(immediateOf(word(line('addi', r(10), r(11), imm(value))), 'I')).toBe(u32(value));
    expect(immediateOf(word(line('lw', r(10), mem(11, value))), 'I')).toBe(u32(value));
  });

  it.each([0, 4, 31, 32, 2047, -1, -2048, -36])('reads the S offset %i back', (value) => {
    expect(immediateOf(word(line('sw', r(10), mem(11, value))), 'S')).toBe(u32(value));
  });

  it.each([
    [0, 3],
    [10, 2],
    [5, 5],
    [0, 1000],
    [1000, 0]
  ])('reads the distance of a branch at line %i to line %i', (from, to) => {
    const instruction = line('beq', r(10), r(11), label(to));
    expect(immediateOf(word(instruction, from * 4), 'B')).toBe(u32((to - from) * 4));
  });

  it.each([
    [0, 3],
    [10, 2],
    [0, 100000],
    [100000, 0]
  ])('reads the distance of a jump at line %i to line %i', (from, to) => {
    const instruction = line('jal', r(1), label(to));
    expect(immediateOf(word(instruction, from * 4), 'J')).toBe(u32((to - from) * 4));
  });

  it.each([0, 1, 0x12345, 0x80000, 0xfffff])('reads the upper immediate %i shifted up', (value) => {
    expect(immediateOf(word(line('lui', r(10), imm(value))), 'U')).toBe(u32(value << 12));
    expect(immediateOf(word(line('auipc', r(10), imm(value))), 'U')).toBe(u32(value << 12));
  });
});
