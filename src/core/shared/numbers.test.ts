import { describe, expect, it } from 'vitest';
import { formatBits, formatBytes, hexSuffixed, littleEndian, parseNumber } from './numbers';

describe('hexSuffixed', () => {
  it('writes hex as 8086 listings do, a 0 before a first letter, and reads back', () => {
    expect(hexSuffixed(0x100)).toBe('100h');
    expect(hexSuffixed(0xa000)).toBe('0A000h');
    expect(hexSuffixed(0x84, 16)).toBe('0084h');
    expect(hexSuffixed(0xffff, 16)).toBe('0FFFFh');
    for (const value of [0x100, 0xa000, 0xffff]) {
      expect(parseNumber(hexSuffixed(value, 16))).toBe(value);
    }
  });
});

describe('littleEndian', () => {
  it('puts the first byte lowest', () => {
    expect(littleEndian([0x34, 0x12])).toBe(0x1234);
    expect(littleEndian([0xff])).toBe(0xff);
    expect(littleEndian([])).toBe(0);
  });
});

describe('formatBits and formatBytes', () => {
  it('pads a bit field to its width', () => {
    expect(formatBits(0b11, 2)).toBe('11');
    expect(formatBits(0b1, 3)).toBe('001');
  });

  it('writes bytes as spaced hex pairs', () => {
    expect(formatBytes([0xb8, 0x0a, 0x00])).toBe('B8 0A 00');
    expect(formatBytes([])).toBe('');
  });
});

describe('parseNumber', () => {
  it('reads $2A as hex, as 6502 code writes it', () => {
    expect(parseNumber('$2A')).toBe(0x2a);
    expect(parseNumber('$d010')).toBe(0xd010);
    expect(parseNumber('-$10')).toBe(-16);
    expect(parseNumber('$')).toBeNull();
  });
});
