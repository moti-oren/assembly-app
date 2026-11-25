import { describe, expect, it } from 'vitest';
import { step, type Program } from '@/core/shared/program';
import { X86 } from '@/core/x86/architecture';
import type { ExecutionRecord } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';
import type { Operand } from '@/core/x86/operands';
import { followHistory, newWriters } from './stackWriters';
import { X86_STACK_BASE, x86Stack } from './x86Stack';

const reg = (name: 'ax' | 'bx'): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const line = (mnemonic: Instruction['mnemonic'], ...operands: Operand[]): Instruction => ({
  mnemonic,
  operands
});

/** The stack after `steps` instructions of `program`, as rows of `address value label`. */
function stackAfter(program: Program<Instruction>, steps: number) {
  const state = X86.createState();
  const history: ExecutionRecord[] = [];
  for (let i = 0; i < steps; i++) history.push(step(X86, state, program));
  const writers = newWriters();
  followHistory(writers, history);
  return x86Stack(state, history, writers);
}

const rows = (view: ReturnType<typeof x86Stack>) =>
  view.entries.map((entry) => `${entry.address} ${entry.value} ${entry.label}`);

describe('x86Stack', () => {
  const swap = [
    line('mov', reg('ax'), imm(0x1234)),
    line('push', reg('ax')),
    line('mov', reg('bx'), imm(7)),
    line('push', reg('bx')),
    line('pop', reg('bx'))
  ];

  it('starts where a fresh CPU has SP', () => {
    expect(X86.createState().registers.sp).toBe(X86_STACK_BASE);
  });

  it('is empty before anything is pushed', () => {
    const view = stackAfter(swap, 1);
    expect(view.entries).toEqual([]);
    expect(view.pointer).toBe('SS:SP 2000:FFFE');
  });

  it('lists the words from the top down, each with who pushed it', () => {
    const view = stackAfter(swap, 4);
    expect(rows(view)).toEqual(['FFFA 0007h bx', 'FFFC 1234h ax']);
    expect(view.entries.map((entry) => entry.source)).toEqual(['L3 · push bx', 'L1 · push ax']);
    expect(view.entries.map((entry) => entry.top)).toEqual([true, false]);
    // Only the word the last instruction pushed is marked as written.
    expect(view.entries.map((entry) => entry.change)).toEqual(['write', null]);
  });

  it('keeps a popped word in sight above the top, as read', () => {
    const view = stackAfter(swap, 5);
    expect(rows(view)).toEqual(['FFFA 0007h bx', 'FFFC 1234h ax']);
    expect(view.entries.map((entry) => [entry.popped, entry.change, entry.top])).toEqual([
      [true, 'read', false],
      [false, null, true]
    ]);
  });

  it('names the line a call returns to', () => {
    const program = [line('call', { type: 'label', target: 2 }), line('nop'), line('ret')];
    const view = stackAfter(program, 1);
    expect(rows(view)).toEqual(['FFFC 0001h return to L1']);
    expect(view.entries[0].returns).toBe(true);
  });

  it('says how many older words are not listed', () => {
    const program = Array.from({ length: 20 }, () => line('push', reg('ax')));
    const view = stackAfter(program, 20);
    expect(view.entries).toHaveLength(16);
    expect(view.hidden).toBe(4);
  });

  it('says the stack wrapped when more was taken off than was put on', () => {
    const view = stackAfter([line('pop', reg('ax'))], 1);
    expect(view.entries).toEqual([]);
    expect(view.hidden).toBe(0);
    expect(view.note).toContain('wrapped round to 0000');
  });
});
