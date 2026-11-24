import { describe, expect, it } from 'vitest';
import { execute } from '@/core/mos6502/execute';
import type { Instruction } from '@/core/mos6502/instructions';
import { createCpuState } from '@/core/mos6502/state';
import { memoryAccessOf } from './mos6502Access';

const run = (cpu: ReturnType<typeof createCpuState>, instruction: Instruction) =>
  execute(cpu, instruction, null, []);
const bare = (mnemonic: Instruction['mnemonic']): Instruction => ({ mnemonic, operands: [] });

describe('memoryAccessOf', () => {
  it('gives a load or a store as the record keeps it', () => {
    const cpu = createCpuState();
    const sta = run(cpu, {
      mnemonic: 'sta',
      operands: [{ type: 'zp', address: 0x10, index: null }]
    });
    expect(memoryAccessOf(sta, cpu.memory)).toEqual({
      address: 0x10,
      size: 1,
      text: 'Wrote $00 to $0010'
    });
  });

  it('says what a push and a pull moved, and where', () => {
    const cpu = createCpuState();
    cpu.registers.a = 0x41;
    expect(memoryAccessOf(run(cpu, bare('pha')), cpu.memory)).toEqual({
      address: 0x01ff,
      size: 1,
      text: 'Pushed $41 at $01FF'
    });
    expect(memoryAccessOf(run(cpu, bare('pla')), cpu.memory)?.text).toBe('Pulled $41 at $01FF');
  });

  it('has nothing to say for an instruction that leaves memory alone', () => {
    const cpu = createCpuState();
    expect(memoryAccessOf(run(cpu, bare('inx')), cpu.memory)).toBeNull();
  });
});
