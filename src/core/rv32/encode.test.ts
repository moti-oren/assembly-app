import { describe, expect, it } from 'vitest';
import { assemble, encode } from './encode';
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

const word = (instruction: Instruction) => encode(instruction).encoding.word;

// Each expected word was checked by disassembling it with Capstone.
describe('encode', () => {
  it('encodes each format', () => {
    expect(word(line('add', r('a0'), r('a1'), r('a2')))).toBe(0x00c58533);
    expect(word(line('sub', r('a0'), r('a1'), r('a2')))).toBe(0x40c58533);
    expect(word(line('mul', r('t0'), r('t1'), r('t2')))).toBe(0x027302b3);
    expect(word(line('addi', r('a0'), r('zero'), imm(5)))).toBe(0x00500513);
    expect(word(line('addi', r('a0'), r('a0'), imm(-1)))).toBe(0xfff50513);
    expect(word(line('srai', r('a0'), r('a0'), imm(3)))).toBe(0x40355513);
    expect(word(line('lw', r('a0'), at(8, 'sp')))).toBe(0x00812503);
    expect(word(line('sw', r('a1'), at(4, 'sp')))).toBe(0x00b12223);
    expect(word(line('jalr', r('zero'), at(0, 'ra')))).toBe(0x00008067);
    expect(word(line('lui', r('a0'), imm(0x12345)))).toBe(0x12345537);
  });

  it('stores the word low byte first', () => {
    expect(encode(line('add', r('a0'), r('a1'), r('a2'))).encoding.bytes).toEqual([
      0x33, 0x85, 0xc5, 0x00
    ]);
  });

  it('measures branches and JAL in bytes from the instruction itself', () => {
    const { lines } = assemble([
      line('beq', r('a0'), r('zero'), label(2)),
      line('addi', r('zero'), r('zero'), imm(0)),
      line('jal', r('ra'), label(0))
    ]);
    expect(lines.map((assembled) => assembled.address)).toEqual([0, 4, 8]);
    expect(lines[0].encoding.word).toBe(0x00050463); // +8
    expect(lines[2].encoding.word).toBe(0xff9ff0ef); // -8
  });

  it('splits the B-type immediate into its four pieces', () => {
    const { fields } = encode(line('beq', r('a0'), r('zero'), label(2)), []).encoding;
    expect(fields.map((field) => field.label)).toEqual([
      'imm[12]',
      'imm[10:5]',
      'rs2',
      'rs1',
      'funct3',
      'imm[4:1]',
      'imm[11]',
      'opcode'
    ]);
  });

  it('reports a branch out of range', () => {
    const far = Array.from({ length: 1100 }, () => line('addi', r('zero'), r('zero'), imm(0)));
    const { lines } = assemble([line('beq', r('a0'), r('a1'), label(1100)), ...far]);
    expect(lines[0].encoding.problem).toContain('Out of range');
  });
});
