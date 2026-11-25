import { describe, expect, it } from 'vitest';
import { formatInstruction, type Instruction, type Mnemonic } from './instructions';
import type { Operand } from './operands';

const reg = (name: 'al' | 'ax'): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

describe('formatInstruction', () => {
  it('writes an amount up to 255 in decimal and a larger one in hex', () => {
    expect(formatInstruction(line('mov', reg('al'), imm(255)))).toBe('mov al, 255');
    expect(formatInstruction(line('mov', reg('ax'), imm(256)))).toBe('mov ax, 100h');
    expect(formatInstruction(line('mov', reg('ax'), imm(0xa000)))).toBe('mov ax, 0A000h');
    const direct: Operand = { type: 'mem', size: 16, base: null, displacement: 0xa000 };
    expect(formatInstruction(line('mov', direct, reg('ax')))).toBe('mov word [0A000h], ax');
    expect(formatInstruction(line('mov', reg('ax'), imm(-1)))).toBe('mov ax, -1');
  });

  it('writes an interrupt and a port in hex, as listings and the devices panel do', () => {
    expect(formatInstruction(line('int', imm(3)))).toBe('int 3');
    expect(formatInstruction(line('int', imm(0x21)))).toBe('int 21h');
    expect(formatInstruction(line('out', imm(0x10), reg('al')))).toBe('out 10h, al');
    expect(formatInstruction(line('in', reg('al'), imm(0x11)))).toBe('in al, 11h');
  });
});
