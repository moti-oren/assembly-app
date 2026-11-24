import { describe, expect, it } from 'vitest';
import { solveRegisterFile } from '@/core/logic/registerFile';
import {
  addressBits,
  decoderText,
  filePhaseText,
  fileRows,
  fileTitle,
  FREE_FILE,
  registerOf,
  withAddressBitFlipped,
  withWriteFlipped
} from './storageFile';

const solved = (over = {}) => solveRegisterFile({ ...FREE_FILE.request, ...over });
const wired = { ...FREE_FILE, request: { ...FREE_FILE.request, zeroWired: true, address: 0 } };

describe('edits', () => {
  it('flips one bit of the address', () => {
    expect(withAddressBitFlipped(FREE_FILE.request, 1).address).toBe(7);
    expect(withAddressBitFlipped(FREE_FILE.request, 0).address).toBe(4);
  });

  it('flips the write line', () => {
    const off = withWriteFlipped(FREE_FILE.request);
    expect(off.write).toBe(0);
    expect(withWriteFlipped(off).write).toBe(1);
  });

  it('gives the address bit 0 first', () => {
    expect(addressBits(FREE_FILE.request)).toEqual([1, 0, 1]);
  });
});

describe('fileRows', () => {
  it('shows the old value until the clock rises, and marks the write from then on', () => {
    const before = fileRows(FREE_FILE, solved(), 'before')[5];
    expect(before).toMatchObject({ name: 'R5', address: '101', value: '0x55', load: 1 });
    expect(before.written).toBe(false);
    const high = fileRows(FREE_FILE, solved(), 'high');
    expect(high[5]).toMatchObject({ value: '0xA5', written: true, tone: 'strong' });
    expect(high[4].tone).toBe('plain');
    expect(fileRows(FREE_FILE, solved(), 'high', true)[5].tone).toBe('changed');
    expect(high.filter((row) => row.written)).toHaveLength(1);
    expect(high[4]).toMatchObject({ value: '0x44', load: 0, written: false });
  });

  it('marks the register that has no flip-flops', () => {
    const [zero, one] = fileRows(wired, solveRegisterFile(wired.request), 'after');
    expect(zero).toMatchObject({ wired: true, value: '0x00', load: 0, written: false });
    expect(zero.label).toContain('wired to 0');
    expect(one.wired).toBe(false);
  });
});

describe('the text', () => {
  it('names the size of the file', () => {
    expect(fileTitle(FREE_FILE.request)).toBe('8 registers of 8 bits');
  });

  it('says which register the decoder picked', () => {
    expect(decoderText(FREE_FILE, solved())).toBe(
      'Address 101 is R5: its load line is the only one on, so the clock writes R5 and no other register.'
    );
  });

  it('says why nothing is written', () => {
    expect(decoderText(FREE_FILE, solved({ write: 0 }))).toContain('the write line is 0');
    expect(decoderText(wired, solveRegisterFile(wired.request))).toContain('no flip-flops');
  });

  it('tells the clock cycle, with or without a write', () => {
    expect(filePhaseText(solved(), 'high')).toContain('took the value');
    expect(filePhaseText(solved({ write: 0 }), 'high')).toContain('every register kept');
    expect(filePhaseText(solved(), 'before')).toContain('The clock is low');
  });
});

describe('registerOf', () => {
  it('gives the register its load line on every write line', () => {
    expect(registerOf(FREE_FILE, solved(), 5)).toEqual({
      register: 'R5',
      part: null,
      request: { width: 8, held: 0x55, input: 0xa5, enabled: 0xff }
    });
    expect(registerOf(FREE_FILE, solved(), 2)?.request.enabled).toBe(0);
  });

  it('has nothing for a register without flip-flops', () => {
    expect(registerOf(wired, solveRegisterFile(wired.request), 0)).toBeNull();
  });
});
