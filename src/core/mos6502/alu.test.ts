import { describe, expect, it } from 'vitest';
import { add, compare, shift, subtract } from './alu';

describe('binary arithmetic', () => {
  it('sets C on an unsigned carry and V on a signed overflow', () => {
    expect(add(0xff, 0x01, false, false)).toEqual({
      result: 0x00,
      carry: true,
      zero: true,
      negative: false,
      overflow: false
    });
    expect(add(0x7f, 0x01, false, false)).toMatchObject({
      result: 0x80,
      overflow: true,
      negative: true
    });
    expect(add(0x10, 0x20, true, false).result).toBe(0x31);
  });

  it('subtracts with C meaning "no borrow"', () => {
    expect(subtract(0x05, 0x03, true, false)).toMatchObject({ result: 0x02, carry: true });
    expect(subtract(0x05, 0x03, false, false)).toMatchObject({ result: 0x01, carry: true });
    expect(subtract(0x03, 0x05, true, false)).toMatchObject({ result: 0xfe, carry: false });
    expect(subtract(0x80, 0x01, true, false)).toMatchObject({ result: 0x7f, overflow: true });
  });

  it('compares like a subtraction that keeps no result', () => {
    expect(compare(5, 5)).toMatchObject({ zero: true, carry: true });
    expect(compare(4, 5)).toMatchObject({ zero: false, carry: false, negative: true });
  });

  it('shifts and rotates through C', () => {
    expect(shift('asl', 0x81, false)).toMatchObject({ result: 0x02, carry: true });
    expect(shift('lsr', 0x01, false)).toMatchObject({ result: 0x00, carry: true, zero: true });
    expect(shift('rol', 0x80, true)).toMatchObject({ result: 0x01, carry: true });
    expect(shift('ror', 0x01, true)).toMatchObject({ result: 0x80, carry: true, negative: true });
  });
});

// Expected values follow the NMOS 6502 as documented by Bruce Clark, "Decimal Mode", appendix A.
describe('decimal arithmetic', () => {
  it('adds BCD digits', () => {
    expect(add(0x19, 0x01, false, true)).toMatchObject({ result: 0x20, carry: false });
    expect(add(0x58, 0x46, true, true)).toMatchObject({ result: 0x05, carry: true });
    expect(add(0x12, 0x34, false, true).result).toBe(0x46);
  });

  it('takes Z from the binary sum, and N and V from the sum before the high digit is adjusted', () => {
    // 99 + 01 = 00 with a carry; the binary sum is $9A, so Z stays 0.
    expect(add(0x99, 0x01, false, true)).toEqual({
      result: 0x00,
      carry: true,
      zero: false,
      negative: true,
      overflow: false
    });
    // 79 + 01: the unadjusted sum is $80, which is negative and overflows as signed.
    expect(add(0x79, 0x01, false, true)).toMatchObject({
      result: 0x80,
      negative: true,
      overflow: true
    });
  });

  it('subtracts BCD digits, with every flag as binary SBC sets it', () => {
    expect(subtract(0x20, 0x01, true, true)).toMatchObject({ result: 0x19, carry: true });
    expect(subtract(0x00, 0x01, true, true)).toMatchObject({
      result: 0x99,
      carry: false,
      negative: true,
      zero: false
    });
    expect(subtract(0x46, 0x12, false, true).result).toBe(0x33);
  });
});
