import { describe, expect, it } from 'vitest';
import { decode } from '@/core/x86/decode';
import { execute } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';
import { createCpuState } from '@/core/x86/state';
import { messagesFor } from './locale';
import { describeCycle, describeDecode, describeExecute } from './x86Cycle';

const m = messagesFor('en');

const movAxBx: Instruction = {
  mnemonic: 'mov',
  operands: [
    { type: 'reg', name: 'ax' },
    { type: 'reg', name: 'bx' }
  ]
};
const addAx1: Instruction = {
  mnemonic: 'add',
  operands: [
    { type: 'reg', name: 'ax' },
    { type: 'imm', value: 1 }
  ]
};
const subAx1: Instruction = {
  mnemonic: 'sub',
  operands: [
    { type: 'reg', name: 'ax' },
    { type: 'imm', value: 1 }
  ]
};
const jmpL5: Instruction = { mnemonic: 'jmp', operands: [{ type: 'label', target: 5 }] };

describe('describeCycle', () => {
  it('says where IP points while the line is fetched', () => {
    const pending = { phase: 'fetch' as const, line: 2, instruction: movAxBx };
    expect(describeCycle(m, createCpuState(), null, pending)).toBe(
      'IP points at L2. That line is read out of the program, and IP moves on to L3 before anything runs.'
    );
  });

  it('says nothing before anything has run', () => {
    expect(describeCycle(m, createCpuState(), null, null)).toBeNull();
  });
});

describe('describeDecode', () => {
  it('names each operand and what the instruction will read and write', () => {
    const text = describeDecode(m, decode(movAxBx));
    expect(text).toContain('Here ax is the destination (16-bit register), bx is the source');
    expect(text).toContain('It will read BX.');
    expect(text).toContain('It will write AX.');
  });

  it('lists everything it writes, the flags included', () => {
    expect(describeDecode(m, decode(addAx1))).toContain('It will write AX and the flags.');
  });
});

describe('describeExecute', () => {
  it('lists what changed and where IP went next', () => {
    const state = createCpuState();
    const record = execute(state, subAx1, 0);
    expect(describeExecute(m, state, record)).toBe(
      'It changed AX and the flags. IP is at L1, the next line.'
    );
  });

  it('says when an instruction jumped', () => {
    const state = createCpuState();
    const record = execute(state, jmpL5, 0);
    expect(describeExecute(m, state, record)).toBe(
      'It changed no register, flag or memory. It jumped: IP is now L5.'
    );
  });

  it('says that an instruction run from the builder was not fetched', () => {
    const state = createCpuState();
    const record = execute(state, addAx1);
    expect(describeExecute(m, state, record)).toMatch(/^Run directly/);
  });

  it('is worded in Hebrew too', () => {
    const state = createCpuState();
    const record = execute(state, subAx1, 0);
    const text = describeExecute(messagesFor('he'), state, record).replace(/[\u200f\u2060]/g, '');
    expect(text).toBe('היא שינתה את AX והדגלים. IP ב-L1, השורה הבאה.');
  });
});
