import { describe, expect, it } from 'vitest';
import { RV32 } from '@/core/rv32/architecture';
import type { Instruction as Rv32Instruction } from '@/core/rv32/instructions';
import { X86 } from '@/core/x86/architecture';
import { rv32UsesDevices, x86UsesDevices } from './usesDevices';

const example = <I>(examples: readonly { name: string; program: readonly I[] }[], name: string) =>
  examples.find((candidate) => candidate.name === name)!.program;

describe('x86UsesDevices', () => {
  it('sees IN and OUT', () => {
    expect(x86UsesDevices(example(X86.examples, 'Running light'), null)).toBe(true);
    expect(x86UsesDevices(example(X86.examples, 'Sum 1..10'), null)).toBe(false);
  });
});

describe('rv32UsesDevices', () => {
  it('sees the devices base loaded into a register', () => {
    expect(rv32UsesDevices(example(RV32.examples, 'Running light'), null)).toBe(true);
    expect(rv32UsesDevices(example(RV32.examples, 'Sum 1..10'), null)).toBe(false);
  });

  it('sees a load or store that went to a device', () => {
    const state = RV32.createState();
    state.registers.x8 = 0x10000000;
    const load: Rv32Instruction = {
      mnemonic: 'lbu',
      operands: [
        { type: 'reg', index: 5 },
        { type: 'mem', base: 8, offset: 0x11 }
      ]
    };
    const record = RV32.execute(state, load, null, []);
    expect(rv32UsesDevices([], record)).toBe(true);
  });
});
