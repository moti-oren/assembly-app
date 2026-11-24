import { describe, expect, it } from 'vitest';
import { bytesOf, misread, storedBytes, valueOfBytes } from './bytes';

describe('bytesOf', () => {
  it('gives the bytes as the value is written', () => {
    expect(bytesOf(0x12, 8)).toEqual([0x12]);
    expect(bytesOf(0x1234, 16)).toEqual([0x12, 0x34]);
    expect(bytesOf(0x89abcdef, 32)).toEqual([0x89, 0xab, 0xcd, 0xef]);
  });

  it('keeps the leading zeros of a small value', () => {
    expect(bytesOf(0x7, 32)).toEqual([0, 0, 0, 7]);
  });
});

describe('storedBytes', () => {
  it('puts the low byte at the lowest address, little end first', () => {
    expect(storedBytes(0x1234, 16, 'little')).toEqual([0x34, 0x12]);
    expect(storedBytes(0x89abcdef, 32, 'little')).toEqual([0xef, 0xcd, 0xab, 0x89]);
  });

  it('puts the high byte at the lowest address, big end first', () => {
    expect(storedBytes(0x1234, 16, 'big')).toEqual([0x12, 0x34]);
  });

  it('has one way to store a single byte', () => {
    expect(storedBytes(0xa5, 8, 'little')).toEqual(storedBytes(0xa5, 8, 'big'));
  });
});

describe('valueOfBytes', () => {
  it('reads back what was stored, in the same order', () => {
    for (const order of ['little', 'big'] as const) {
      for (const [value, width] of [
        [0x1234, 16],
        [0x89abcdef, 32],
        [0xff000001, 32]
      ] as const) {
        expect(valueOfBytes(storedBytes(value, width, order), order)).toBe(value);
      }
    }
  });
});

describe('misread', () => {
  it('turns the bytes round', () => {
    expect(misread(0x1234, 16)).toBe(0x3412);
    expect(misread(0x89abcdef, 32)).toBe(0xefcdab89);
  });

  it('changes nothing in a value that reads the same both ways', () => {
    expect(misread(0x4242, 16)).toBe(0x4242);
    expect(misread(0x7f, 8)).toBe(0x7f);
  });
});
