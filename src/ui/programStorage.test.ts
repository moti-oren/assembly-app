import { describe, expect, it } from 'vitest';
import { MOS6502 } from '@/core/mos6502/architecture';
import { RV32 } from '@/core/rv32/architecture';
import type { ProgramInstruction } from '@/core/shared/program';
import { X86 } from '@/core/x86/architecture';
import { parseProgram, programKey, serializeProgram } from './programStorage';

/** Saves and reads back every example of an architecture. */
function roundTrips<I extends ProgramInstruction>(architecture: {
  examples: readonly { program: readonly I[] }[];
  isValid: (instruction: I) => boolean;
}): void {
  for (const example of architecture.examples) {
    const restored = parseProgram(serializeProgram(example.program), architecture.isValid);
    expect(restored).toEqual(example.program);
  }
}

describe('a stored program', () => {
  it('has a key per architecture', () => {
    expect(programKey('x86')).not.toBe(programKey('rv32'));
  });

  it('comes back as it was saved, on every architecture', () => {
    roundTrips(X86);
    roundTrips(RV32);
    roundTrips(MOS6502);
  });

  it('is empty when nothing was saved', () => {
    expect(parseProgram(null, X86.isValid)).toEqual([]);
  });

  it.each([
    ['not JSON', '{oops'],
    ['not a list', '{"mnemonic":"nop","operands":[]}'],
    ['a line that is no instruction', '[42]'],
    ['an unknown mnemonic', '[{"mnemonic":"frobnicate","operands":[]}]'],
    ['operands that are no list', '[{"mnemonic":"nop","operands":"none"}]'],
    ['an operand that is no object', '[{"mnemonic":"push","operands":["ax"]}]'],
    ['an unknown register', '[{"mnemonic":"push","operands":[{"type":"reg","name":"zz"}]}]'],
    ['a nested operand field', '[{"mnemonic":"jmp","operands":[{"type":"label","target":{}}]}]'],
    ['a jump past the end', '[{"mnemonic":"jmp","operands":[{"type":"label","target":7}]}]'],
    [
      'a memory base the 8086 does not have',
      '[{"mnemonic":"mov","operands":[{"type":"reg","name":"ax"},{"type":"mem","size":16,"base":"ax","displacement":0}]}]'
    ],
    ['an unknown prefix', '[{"prefix":"lock","mnemonic":"cmpsb","operands":[]}]'],
    [
      'a prefix named like an object member',
      '[{"prefix":"constructor","mnemonic":"cmpsb","operands":[]}]'
    ],
    ['an empty prefix', '[{"prefix":"","mnemonic":"cmpsb","operands":[]}]'],
    ['a mnemonic named like an object member', '[{"mnemonic":"constructor","operands":[]}]'],
    ['a missing operand', '[{"mnemonic":"mov","operands":[{"type":"reg","name":"ax"}]}]']
  ])('is dropped whole for %s', (_, raw) => {
    expect(parseProgram(raw, X86.isValid)).toEqual([]);
  });

  it('is dropped whole when one line of it is bad', () => {
    const raw = '[{"mnemonic":"nop","operands":[]},{"mnemonic":"frobnicate","operands":[]}]';
    expect(parseProgram(raw, X86.isValid)).toEqual([]);
  });

  it('does not take the program of another architecture', () => {
    const riscv = serializeProgram(RV32.examples[0].program);
    expect(parseProgram(riscv, X86.isValid)).toEqual([]);
    expect(parseProgram(riscv, MOS6502.isValid)).toEqual([]);
  });
});
