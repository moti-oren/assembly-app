import { describe, expect, it } from 'vitest';
import { execute } from '@/core/mos6502/execute';
import type { Instruction } from '@/core/mos6502/instructions';
import { createCpuState } from '@/core/mos6502/state';
import { diagramView } from './mos6502Diagram';

const program: Instruction[] = [
  { mnemonic: 'lda', operands: [{ type: 'abs', address: 0x02f0, index: 'x' }] },
  { mnemonic: 'nop', operands: [] }
];

describe('diagramView', () => {
  it('reads the opcode at PC while fetching', () => {
    const view = diagramView({
      program,
      record: null,
      pending: { phase: 'fetch', line: 0, instruction: program[0] }
    });
    expect(view.registers).toEqual({ pc: 'read' });
    expect(view.internal).toBe('read');
    expect(view.bus.text).toBe('Read the opcode $BD from $0600');
    expect(view.address.use).toBeUndefined();
  });

  it('shows the plan once decoded', () => {
    const view = diagramView({
      program,
      record: null,
      pending: { phase: 'decode', line: 0, instruction: program[0] }
    });
    expect(view.registers).toEqual({ x: 'read' });
    expect(view.address).toEqual({
      use: 'read',
      text: 'will work out the address',
      mode: 'absolute,X'
    });
    expect(view.bus.text).toBe('will read a byte');
  });

  it('shows how the address was formed, what crossed the bus and the cycles', () => {
    const state = createCpuState();
    state.registers.x = 0x20;
    state.memory[0x0310] = 0x55;
    const record = execute(state, program[0], 0, program);
    const view = diagramView({ program, record, pending: null });
    expect(view.registers).toEqual({ x: 'read', a: 'write' });
    expect(view.address.text).toBe('$02F0 + X ($20) = $0310, into page $03');
    expect(view.bus).toEqual({ use: 'read', text: 'Read $55 from $0310' });
    expect(view.cycles).toEqual({ count: 5, text: '5 cycles: 4, plus 1 for crossing a page' });
  });

  it('leaves the internal bus dark before anything has run', () => {
    expect(diagramView({ program, record: null, pending: null }).internal).toBeUndefined();
  });

  it('lights the internal bus as a write once a register was written', () => {
    const state = createCpuState();
    const record = execute(state, program[0], 0, program);
    expect(diagramView({ program, record, pending: null }).internal).toBe('write');
  });
});
