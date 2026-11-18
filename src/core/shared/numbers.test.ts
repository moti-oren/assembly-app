import { describe, expect, it } from 'vitest';
import { formatBits, formatBytes, littleEndian } from './numbers';

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
