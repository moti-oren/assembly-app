import { describe, expect, it } from 'vitest';
import { createCpuState, physicalAddress } from '@/core/x86/state';
import type { MemoryAccess } from './describe';
import { byteLabel, offsetNote, segmentRows, workedAddress } from './x86MemoryView';

describe('segmentRows', () => {
  it('reads rows from the segment and wraps at the end of it', () => {
    const state = createCpuState();
    state.memory[physicalAddress(0x1000, 0xffff)] = 0xaa;
    state.memory[physicalAddress(0x1000, 0x0000)] = 0xbb;
    const [row, next] = segmentRows(state, 0x1000, 0xfffe, 2, 2);
    expect(row.offset).toBe(0xfffe);
    expect(row.bytes.map((byte) => byte.value)).toEqual([0, 0xaa]);
    expect(next.offset).toBe(0x0000);
    expect(next.bytes[0].value).toBe(0xbb);
  });
});

describe('workedAddress', () => {
  const access: MemoryAccess = {
    address: 'DS:0010',
    value: '00',
    write: true,
    segment: 'ds',
    segmentValue: 0x1000,
    offset: 0x10,
    offsetParts: null
  };

  it('prefers the byte under the pointer', () => {
    const worked = workedAddress({ segment: 'ss', segmentValue: 0x2000, offset: 4 }, access);
    expect(worked?.label).toBe('This byte');
    expect(worked?.sum.physical).toBe(0x20004);
    expect(worked?.isLastAccess).toBe(false);
  });

  it('falls back to the last access, or to nothing', () => {
    expect(workedAddress(null, access)?.label).toBe('Last write');
    expect(workedAddress(null, { ...access, write: false })?.label).toBe('Last read');
    expect(workedAddress(null, null)).toBeNull();
  });
});

describe('offsetNote', () => {
  const parts = {
    base: 'bx' as const,
    baseValue: 0xfff0,
    displacement: 0,
    offset: 0,
    wrapped: false
  };

  it('says which register gave the offset, and what was added to it', () => {
    expect(offsetNote(null)).toBeNull();
    expect(offsetNote({ ...parts, base: null })).toBeNull();
    expect(offsetNote(parts)).toBe('offset = BX');
    expect(offsetNote({ ...parts, displacement: 0x20, wrapped: true })).toBe(
      'offset = BX FFF0h + 0020h, wraps at 64K'
    );
  });
});

describe('byteLabel', () => {
  it('says where a byte is, what it holds, and whether it was just written', () => {
    expect(byteLabel(0x11, 0x10011, 0x41, null)).toBe('0011, physical 10011h: 41');
    expect(byteLabel(0x11, 0x10011, 0x41, { unchanged: false })).toContain(
      'written by the last instruction'
    );
    expect(byteLabel(0x11, 0x10011, 0x41, { unchanged: true })).toContain('the value it held');
  });
});
