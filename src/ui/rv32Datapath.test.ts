import { describe, expect, it } from 'vitest';
import { execute } from '@/core/rv32/execute';
import type { Instruction, Mnemonic } from '@/core/rv32/instructions';
import type { Operand } from '@/core/rv32/operands';
import { parseRegister } from '@/core/rv32/registers';
import { createCpuState, DATA_BASE, writeRegister } from '@/core/rv32/state';
import { datapathView } from './rv32Datapath';
import { messagesFor } from './locale';

const m = messagesFor('en');

const r = (name: string): Operand => ({ type: 'reg', index: parseRegister(name)! });
const imm = (value: number): Operand => ({ type: 'imm', value });
const at = (offset: number, base: string): Operand => ({
  type: 'mem',
  base: parseRegister(base)!,
  offset
});
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

describe('datapathView', () => {
  const program = [
    line('addi', r('a0'), r('a1'), imm(2)),
    line('sw', r('a0'), at(4, 's0')),
    line('beq', r('a0'), r('zero'), label(0))
  ];

  it('shows nothing before the first instruction', () => {
    const view = datapathView(m, { state: createCpuState(), program, record: null, pending: null });
    expect(view.instruction).toBeNull();
    expect(view.fetch.use).toBeUndefined();
  });

  it('only reads the word at PC while fetching', () => {
    const view = datapathView(m, {
      state: createCpuState(),
      program,
      record: null,
      pending: { phase: 'fetch', line: 0, instruction: program[0] }
    });
    expect(view.fetch).toEqual({ use: 'read', text: 'PC 0x00000000 → L0: 0x00258513' });
    expect(view.decode.use).toBeUndefined();
    expect(view.reads).toEqual([]);
  });

  it('shows the plan once decoded, before anything has run', () => {
    const view = datapathView(m, {
      state: createCpuState(),
      program,
      record: null,
      pending: { phase: 'decode', line: 0, instruction: program[0] }
    });
    expect(view.decode.fields).toEqual([
      { name: 'format', value: 'I' },
      { name: 'rd', value: 'a0' },
      { name: 'rs1', value: 'a1' },
      { name: 'imm', value: '2' }
    ]);
    expect(view.execute.text).toBe('A = rs1, B = imm');
    expect(view.writeBack.text).toBe("a0 ← the ALU's result");
    expect(view.reads).toEqual([11]);
    expect(view.writes).toEqual([]);
  });

  it('shows what each stage did once the instruction has run', () => {
    const state = createCpuState();
    writeRegister(state, parseRegister('a1')!, 3);
    writeRegister(state, parseRegister('s0')!, DATA_BASE);
    const first = execute(state, program[0], 0, program);
    const view = datapathView(m, { state, program, record: first, pending: null });
    expect(view.execute).toEqual({ use: 'write', text: '0x00000003 + 0x00000002 = 0x00000005' });
    expect(view.memory.use).toBeUndefined();
    expect(view.writeBack.text).toBe("a0 ← 0x00000005, the ALU's result");
    expect(view.nextPc.text).toBe('PC = 0x00000004 (L1)');
    expect(view.writes).toEqual([10]);

    const store = execute(state, program[1], 1, program);
    const stored = datapathView(m, { state, program, record: store, pending: null });
    expect(stored.memory).toEqual({
      use: 'write',
      text: 'Stored the word 0x00000005 at 0x00010004'
    });
    expect(stored.writeBack.use).toBeUndefined();
  });

  it('puts a branch comparison in the next-PC stage', () => {
    const state = createCpuState();
    const record = execute(state, program[2], 2, program);
    const view = datapathView(m, { state, program, record, pending: null });
    expect(view.nextPc).toEqual({
      use: 'write',
      text: 'a0 = 0 = zero = 0: true: jumped to 0x00000000 (L0)'
    });
  });
});
