import { describe, expect, it } from 'vitest';
import { decode } from './decode';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';

const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

describe('decode', () => {
  it('reads the index register of an indexed mode', () => {
    expect(decode(line('lda', { type: 'abs', address: 0x0200, index: 'x' }))).toMatchObject({
      mode: 'abx',
      modeName: 'absolute,X',
      size: 3,
      cycles: 4,
      reads: ['x'],
      writes: ['a'],
      memory: { read: true, write: false },
      flagsWritten: ['N', 'Z']
    });
    expect(decode(line('sta', { type: 'izy', address: 0x10 }))).toMatchObject({
      reads: ['a', 'y'],
      memory: { read: false, write: true }
    });
  });

  it('reads and writes memory for INC and the shifts, but A for a shift of A', () => {
    expect(decode(line('inc', { type: 'zp', address: 0x10, index: null })).memory).toEqual({
      read: true,
      write: true
    });
    expect(decode(line('asl', { type: 'acc' }))).toMatchObject({
      reads: ['a'],
      writes: ['a'],
      memory: { read: false, write: false },
      flagsWritten: ['N', 'Z', 'C']
    });
  });

  it('tells the stack, branches and jumps apart', () => {
    expect(decode(line('pha'))).toMatchObject({
      reads: ['a', 'sp'],
      writes: ['sp'],
      stack: 'push'
    });
    expect(decode(line('rts'))).toMatchObject({ stack: 'pull', nextPc: 'jump' });
    expect(decode(line('bne', { type: 'label', target: 0 }))).toMatchObject({
      mode: 'rel',
      size: 2,
      nextPc: 'branch'
    });
    expect(decode(line('brk')).size).toBe(2);
  });
});
