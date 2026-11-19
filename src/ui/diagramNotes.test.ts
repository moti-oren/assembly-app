import { describe, expect, it } from 'vitest';
import { explainAddress } from '@/core/x86/address';
import { decode } from '@/core/x86/decode';
import { execute } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';
import { createCpuState } from '@/core/x86/state';
import { describeMemoryAccess, describePortAccess } from './describe';
import { adderNote, aluNote, busText, planNote } from './diagramNotes';

const addAxBx: Instruction = {
  mnemonic: 'add',
  operands: [
    { type: 'reg', name: 'ax' },
    { type: 'reg', name: 'bx' }
  ]
};
const pushAx: Instruction = { mnemonic: 'push', operands: [{ type: 'reg', name: 'ax' }] };
const outAl: Instruction = {
  mnemonic: 'out',
  operands: [
    { type: 'imm', value: 0x10 },
    { type: 'reg', name: 'al' }
  ]
};

describe('aluNote', () => {
  it('follows the phases of a stepped line', () => {
    expect(aluNote('fetch', null, null, false)).toMatch(/still being fetched/);
    expect(aluNote('decode', decode(addAxBx), null, false)).toMatch(/^Selected/);
    expect(aluNote('decode', decode(pushAx), null, false)).toBe('Not needed by push.');
  });

  it('says whether the last instruction computed anything here', () => {
    const state = createCpuState();
    expect(aluNote(null, null, null, false)).toMatch(/^Run an instruction/);
    expect(aluNote(null, null, execute(state, addAxBx), true)).toMatch(/^Computed here/);
    expect(aluNote(null, null, execute(state, pushAx), false)).toBe('Not used by push.');
  });
});

describe('adderNote', () => {
  it('stays idle during fetch, since the program is not in memory', () => {
    expect(adderNote('fetch', null, null, false, false)).toMatch(/^Idle/);
  });

  it('is selected for a memory access, and skipped by a port number', () => {
    expect(adderNote('decode', decode(pushAx), null, true, false)).toMatch(/^Selected/);
    expect(adderNote('decode', decode(outAl), null, false, false)).toMatch(/port number/);
    expect(adderNote('decode', decode(addAxBx), null, false, false)).toBe('Not needed by add.');
  });

  it('explains why the last instruction did not use it', () => {
    const state = createCpuState();
    expect(adderNote(null, null, execute(state, outAl), false, true)).toMatch(/port number/);
    expect(adderNote(null, null, execute(state, addAxBx), false, false)).toBe(
      'Not used: add did not touch memory.'
    );
  });
});

describe('planNote', () => {
  it('names what will happen', () => {
    expect(planNote(false, false)).toBe('not used');
    expect(planNote(true, false)).toBe('will be read');
    expect(planNote(false, true)).toBe('will be written');
    expect(planNote(true, true)).toBe('will be read and written');
  });
});

describe('busText', () => {
  it('shows the address and the data of a memory access, or the port of an OUT', () => {
    const state = createCpuState();
    const pushed = execute(state, pushAx);
    const memory = describeMemoryAccess(state, pushed);
    const address = memory && explainAddress(memory.segmentValue, memory.offset);
    expect(busText(memory, address, null)).toMatch(/^address [0-9A-F]{5}h, data 0000$/);

    const out = execute(state, outAl);
    expect(busText(null, null, describePortAccess(state, out))).toMatch(/^port 10h, data /);
    expect(busText(null, null, null)).toBeNull();
  });
});
