import { describe, expect, it } from 'vitest';
import { rangeOf, readAs, readValue, signedOf, wrap } from './readings';

describe('wrap', () => {
  it('keeps the low bits of a number too large', () => {
    expect(wrap(0x1ff, 8)).toBe(0xff);
    expect(wrap(2 ** 32 + 5, 32)).toBe(5);
  });

  it('gives a negative number its two’s complement bits', () => {
    expect(wrap(-1, 8)).toBe(0xff);
    expect(wrap(-1, 32)).toBe(0xffffffff);
  });
});

describe('signedOf', () => {
  it('counts the top bit as minus its weight', () => {
    expect(signedOf(0x7f, 8)).toBe(127);
    expect(signedOf(0x80, 8)).toBe(-128);
    expect(signedOf(0xffff, 16)).toBe(-1);
    expect(signedOf(0x80000000, 32)).toBe(-(2 ** 31));
  });

  it('agrees with readAs', () => {
    expect(readAs(0xff, 8, 'signed')).toBe(-1);
    expect(readAs(0xff, 8, 'unsigned')).toBe(255);
  });
});

describe('rangeOf', () => {
  it('is what the width can hold on each scale', () => {
    expect(rangeOf(8, 'unsigned')).toEqual({ min: 0, max: 255 });
    expect(rangeOf(8, 'signed')).toEqual({ min: -128, max: 127 });
    expect(rangeOf(32, 'unsigned').max).toBe(0xffffffff);
  });
});

describe('readValue', () => {
  it('reads one byte every way', () => {
    expect(readValue(0x41, 8)).toEqual({
      width: 8,
      bits: 0x41,
      binary: '01000001',
      hex: '41',
      unsigned: 65,
      signed: 65,
      characters: ['A'],
      decimal: [41]
    });
  });

  it('has no character or decimal digits where the byte is neither', () => {
    const readings = readValue(0xfa, 8);
    expect(readings.signed).toBe(-6);
    expect(readings.characters).toEqual([null]);
    expect(readings.decimal).toEqual([null]);
  });

  it('reads a wide value a byte at a time, high byte first', () => {
    const readings = readValue(0x4869, 16);
    expect(readings.hex).toBe('4869');
    expect(readings.characters).toEqual(['H', 'i']);
    expect(readings.decimal).toEqual([48, 69]);
    expect(readValue(0xffffffff, 32).hex).toBe('FFFFFFFF');
  });
});
