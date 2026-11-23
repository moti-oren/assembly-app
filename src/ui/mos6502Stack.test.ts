import { describe, expect, it } from 'vitest';
import { step, type Program } from '@/core/shared/program';
import { MOS6502 } from '@/core/mos6502/architecture';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import type { Instruction } from '@/core/mos6502/instructions';
import { MOS6502_STACK_BASE, mos6502Stack } from './mos6502Stack';
import { followHistory, newWriters } from './stackWriters';

const line = (
  mnemonic: Instruction['mnemonic'],
  ...operands: Instruction['operands']
): Instruction => ({ mnemonic, operands });

function stackAfter(program: Program<Instruction>, steps: number) {
  const state = MOS6502.createState();
  const history: ExecutionRecord[] = [];
  for (let i = 0; i < steps; i++) history.push(step(MOS6502, state, program));
  const writers = newWriters();
  followHistory(writers, history);
  return mos6502Stack(state, history, writers);
}

const rows = (view: ReturnType<typeof mos6502Stack>) =>
  view.entries.map((entry) => `${entry.address} ${entry.value} ${entry.label}`);

describe('mos6502Stack', () => {
  it('starts where a fresh CPU has SP', () => {
    expect(MOS6502.createState().registers.sp).toBe(MOS6502_STACK_BASE);
  });

  it('lists a pushed byte, and keeps it in sight once pulled', () => {
    const program = [line('lda', { type: 'imm', value: 0x42 }), line('pha'), line('pla')];
    const pushed = stackAfter(program, 2);
    expect(rows(pushed)).toEqual(['$01FF $42 A']);
    expect(pushed.pointer).toBe('SP $FE');
    expect(pushed.entries[0].source).toBe('L1 · pha');
    const pulled = stackAfter(program, 3);
    expect(pulled.entries.map((entry) => [entry.popped, entry.change])).toEqual([[true, 'read']]);
  });

  it('shows the two bytes JSR pushes as one address, kept less 1', () => {
    // JSR is three bytes at $0600, so it keeps $0602 and RTS comes back to $0603.
    const program = [line('jsr', { type: 'label', target: 2 }), line('nop'), line('rts')];
    const view = stackAfter(program, 1);
    expect(rows(view)).toEqual(['$01FE $0602 return to $0603, kept less 1']);
    expect(view.entries[0].returns).toBe(true);
  });

  it('is empty on a fresh CPU', () => {
    expect(stackAfter([], 0).entries).toEqual([]);
  });
});
