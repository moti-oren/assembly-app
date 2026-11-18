import { describe, expect, it } from 'vitest';
import { assemble, encode } from './encode';
import { INSTRUCTIONS, type Instruction, type Mnemonic } from './instructions';
import type { Operand } from './operands';

const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const bytes = (instruction: Instruction) => encode(instruction).encoding.bytes;

describe('encode', () => {
  it('has the 151 opcodes of the NMOS 6502, each once', () => {
    const opcodes = Object.values(INSTRUCTIONS).flatMap((spec) =>
      Object.values(spec.modes).map((mode) => mode.opcode)
    );
    expect(opcodes.length).toBe(151);
    expect(new Set(opcodes).size).toBe(151);
  });

  it('puts the address low byte first', () => {
    expect(bytes(line('lda', imm(0x42)))).toEqual([0xa9, 0x42]);
    expect(bytes(line('sta', { type: 'abs', address: 0x1234, index: 'x' }))).toEqual([
      0x9d, 0x34, 0x12
    ]);
    expect(bytes(line('lda', { type: 'izy', address: 0x10 }))).toEqual([0xb1, 0x10]);
    expect(bytes(line('jmp', { type: 'ind', address: 0x1234 }))).toEqual([0x6c, 0x34, 0x12]);
    expect(bytes(line('rol', { type: 'acc' }))).toEqual([0x2a]);
  });

  it('gives BRK a signature byte', () => {
    expect(bytes(line('brk'))).toEqual([0x00, 0x00]);
  });

  it('lays lines out from $0600 and measures branches from the next instruction', () => {
    const { lines, size } = assemble([
      line('lda', imm(1)),
      line('jsr', label(3)),
      line('bne', label(0)),
      line('rts')
    ]);
    expect(lines.map((assembled) => assembled.address)).toEqual([0x0600, 0x0602, 0x0605, 0x0607]);
    expect(size).toBe(8);
    expect(lines[1].encoding.bytes).toEqual([0x20, 0x07, 0x06]);
    expect(lines[2].encoding.bytes).toEqual([0xd0, 0xf9]);
  });

  it('reports a branch out of range', () => {
    const far = Array.from({ length: 70 }, () => line('lda', imm(0)));
    const { lines } = assemble([line('beq', label(71)), ...far, line('nop')]);
    expect(lines[0].encoding.problem).toContain('Out of range');
  });
});
