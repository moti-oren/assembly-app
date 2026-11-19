import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS as MOS6502 } from '@/core/mos6502/instructions';
import { CATEGORY_LABELS as RV32 } from '@/core/rv32/instructions';
import { CATEGORY_LABELS as X86 } from '@/core/x86/instructions';
import { groupTone } from './builderTones';

describe('groupTone', () => {
  it('gives every family of instructions a tone, on all three architectures', () => {
    for (const labels of [X86, RV32, MOS6502]) {
      for (const label of Object.values(labels)) {
        expect(groupTone(label), label).not.toBeNull();
      }
    }
  });

  it('puts the same kind of instruction in the same tone whatever it is called', () => {
    expect(groupTone(X86.transfer)).toBe('transfer');
    expect(groupTone(RV32.load)).toBe('transfer');
    expect(groupTone(RV32.store)).toBe('transfer');
    expect(groupTone(MOS6502.load)).toBe('transfer');
    expect(groupTone(X86.shift)).toBe('shift');
    expect(groupTone(RV32.shift)).toBe('shift');
    expect(groupTone(X86.control)).toBe('control');
    expect(groupTone(RV32.branch)).toBe('control');
    expect(groupTone(MOS6502.jump)).toBe('control');
    expect(groupTone(MOS6502.arithmetic)).toBe('arithmetic');
    expect(groupTone(RV32.multiply)).toBe('arithmetic');
  });

  it('tells the stack apart from the other transfers', () => {
    expect(groupTone(MOS6502.stack)).toBe('stack');
  });

  it('leaves groups of operands neutral', () => {
    for (const group of ['Memory', 'Count', 'Immediate (8-bit)', 'Direct address', 'Accumulator']) {
      expect(groupTone(group), group).toBeNull();
    }
  });
});
