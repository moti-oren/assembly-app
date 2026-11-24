import { describe, expect, it } from 'vitest';
import { disassemble, formatDisassembly, wordLayout } from './disassemble';
import { encodeAt } from './encode';
import { getSpec, MNEMONICS, type Instruction, type Mnemonic } from './instructions';
import type { Operand, OperandKind } from './operands';
import { parseRegister } from './registers';
import { addressOfLine } from './state';

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** The line the instruction under test sits on. */
const AT = 20;

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

function operand(kind: OperandKind, next: () => number): Operand {
  switch (kind) {
    case 'reg':
      return { type: 'reg', index: next() % 32 };
    case 'imm12':
      return { type: 'imm', value: (next() % 4096) - 2048 };
    case 'shamt':
      return { type: 'imm', value: next() % 32 };
    case 'imm20':
      return { type: 'imm', value: next() % 2 ** 20 };
    case 'mem':
      return { type: 'mem', base: next() % 32, offset: (next() % 4096) - 2048 };
    case 'label':
      return { type: 'label', target: next() % 40 };
  }
}

function sample(mnemonic: Mnemonic, next: () => number): Instruction {
  return line(mnemonic, ...getSpec(mnemonic).form.map((kind) => operand(kind, next)));
}

const wordOf = (instruction: Instruction) => encodeAt(instruction, addressOfLine(AT));

describe('disassemble', () => {
  it.each(MNEMONICS)('reads %s back from the word the encoder made', (mnemonic) => {
    const next = random(MNEMONICS.indexOf(mnemonic) + 1);
    for (let round = 0; round < 40; round++) {
      const { word, fields } = wordOf(sample(mnemonic, next));
      expect(disassemble(word)?.mnemonic).toBe(mnemonic);
      expect(wordLayout(word)).toEqual(fields);
    }
  });

  it('knows no instruction in a word with an unused opcode', () => {
    expect(disassemble(0)).toBeNull();
    expect(disassemble(0xffffffff)).toBeNull();
    expect(wordLayout(0)).toBeNull();
  });

  it('refuses a funct7 no instruction has, which the decoders of the control topic do not read', () => {
    const { word } = wordOf(line('add', r('a0'), r('a0'), r('a1')));
    expect(disassemble((word | (1 << 31)) >>> 0)).toBeNull();
  });
});

describe('formatDisassembly', () => {
  const text = (instruction: Instruction) =>
    formatDisassembly(disassemble(wordOf(instruction).word)!);

  it('writes registers and immediates as assembly does', () => {
    expect(text(line('sub', r('a0'), r('a0'), r('a1')))).toBe('sub a0, a0, a1');
    expect(text(line('addi', r('t0'), r('sp'), { type: 'imm', value: -16 }))).toBe(
      'addi t0, sp, -16'
    );
    expect(text(line('srai', r('a0'), r('a1'), { type: 'imm', value: 3 }))).toBe('srai a0, a1, 3');
    expect(text(line('lui', r('a0'), { type: 'imm', value: 0x12345 }))).toBe('lui a0, 0x12345');
  });

  it('writes a load, a store and JALR with their address', () => {
    const at: Operand = { type: 'mem', base: parseRegister('sp')!, offset: 8 };
    expect(text(line('lw', r('a0'), at))).toBe('lw a0, 8(sp)');
    expect(text(line('sw', r('a0'), at))).toBe('sw a0, 8(sp)');
    expect(text(line('jalr', r('ra'), at))).toBe('jalr ra, 8(sp)');
  });

  it('writes a target as its distance from the instruction', () => {
    expect(text(line('beq', r('a0'), r('a1'), { type: 'label', target: AT + 4 }))).toBe(
      'beq a0, a1, pc + 16'
    );
    expect(text(line('jal', r('ra'), { type: 'label', target: AT - 2 }))).toBe('jal ra, pc - 8');
  });
});
