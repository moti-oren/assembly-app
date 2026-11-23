import { describe, expect, it } from 'vitest';
import { step, type Program } from '@/core/shared/program';
import { RV32 } from '@/core/rv32/architecture';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import type { Operand } from '@/core/rv32/operands';
import { RA, SP } from '@/core/rv32/registers';
import { rv32Stack } from './rv32Stack';
import { followHistory, newWriters } from './stackWriters';

const T0 = 5;
const reg = (index: number): Operand => ({ type: 'reg', index });
const imm = (value: number): Operand => ({ type: 'imm', value });
const at = (offset: number): Operand => ({ type: 'mem', base: SP, offset });
const line = (mnemonic: Instruction['mnemonic'], ...operands: Operand[]): Instruction => ({
  mnemonic,
  operands
});

function stackAfter(program: Program<Instruction>, steps: number) {
  const state = RV32.createState();
  const history: ExecutionRecord[] = [];
  for (let i = 0; i < steps; i++) history.push(step(RV32, state, program));
  const writers = newWriters();
  followHistory(writers, history);
  return rv32Stack(state, history, writers);
}

const rows = (view: ReturnType<typeof rv32Stack>) =>
  view.entries.map((entry) => `${entry.address} ${entry.value} ${entry.label}`);

describe('rv32Stack', () => {
  const frame = [
    line('addi', reg(T0), reg(0), imm(0x55)),
    line('addi', reg(SP), reg(SP), imm(-8)),
    line('sw', reg(RA), at(4)),
    line('sw', reg(T0), at(0)),
    line('addi', reg(SP), reg(SP), imm(8))
  ];

  it('is empty until the program lowers sp', () => {
    const view = stackAfter(frame, 1);
    expect(view.entries).toEqual([]);
    expect(view.pointer).toBe('sp 0x00100000');
  });

  it('lists the room sp made, written or not', () => {
    expect(rows(stackAfter(frame, 2))).toEqual([
      '0x000FFFF8 0x00000000 not written yet',
      '0x000FFFFC 0x00000000 not written yet'
    ]);
  });

  it('names the register each word was stored from, and marks the return address', () => {
    const view = stackAfter(frame, 4);
    expect(rows(view)).toEqual([
      '0x000FFFF8 0x00000055 t0',
      '0x000FFFFC 0x00000000 ra, the return address'
    ]);
    expect(view.entries.map((entry) => entry.source)).toEqual([
      'L3 · sw t0, 0(sp)',
      'L2 · sw ra, 4(sp)'
    ]);
    expect(view.entries.map((entry) => entry.returns)).toEqual([false, true]);
    expect(view.entries.map((entry) => entry.change)).toEqual(['write', null]);
  });

  it('keeps the words sp gave back in sight, off the stack', () => {
    const view = stackAfter(frame, 5);
    expect(view.entries.map((entry) => entry.popped)).toEqual([true, true]);
  });

  it('says so when sp points somewhere else', () => {
    const view = stackAfter([line('addi', reg(SP), reg(0), imm(3))], 1);
    expect(view.entries).toEqual([]);
    expect(view.empty).toBe('sp does not point into the stack.');
  });
});
