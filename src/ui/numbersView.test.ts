import { describe, expect, it } from 'vitest';
import { solveNumber, type NumberRequest } from '@/core/representation/request';
import {
  bitsOf,
  equationText,
  freeRequest,
  freeView,
  sameOperation,
  widthAllowed,
  widthOf,
  withBitFlipped,
  withExtraFlipped,
  withOperand
} from './numbersView';

const sum: NumberRequest = { kind: 'add', width: 8, a: 0x7f, b: 0x01, extra: 0 };
const text = (request: NumberRequest) => equationText(request, solveNumber(request));

describe('freeRequest', () => {
  it('starts from values that wrap on the signed scale', () => {
    expect(freeRequest('add', 8, null)).toEqual(sum);
  });

  it('keeps the operands when the lens changes, as far as they fit', () => {
    const wide: NumberRequest = { kind: 'add', width: 16, a: 0x1234, b: 0x00ff, extra: 1 };
    expect(freeRequest('subtract', 8, wide)).toEqual({
      kind: 'subtract',
      width: 8,
      a: 0x34,
      b: 0xff,
      extra: 0
    });
    expect(freeRequest('value', 16, wide)).toEqual({ kind: 'value', width: 16, bits: 0x1234 });
  });

  it('extends to at least 16 bits, from fewer bits than that', () => {
    expect(freeRequest('extend', 8, sum)).toMatchObject({ kind: 'extend', from: 8, to: 16 });
    const fromWord: NumberRequest = {
      kind: 'extend',
      value: 0x8000,
      from: 16,
      to: 32,
      signed: false
    };
    expect(freeRequest('extend', 16, fromWord)).toMatchObject({ from: 8, to: 16, signed: false });
  });

  it('starts a decimal sum from decimal bytes only', () => {
    expect(freeRequest('bcd', 8, sum)).toMatchObject({ a: 0x19, b: 0x01 });
    expect(freeRequest('bcd', 8, { ...sum, a: 0x42 })).toMatchObject({ a: 0x42 });
  });
});

describe('widthOf', () => {
  it('is the width of the row a request ends in', () => {
    expect(widthOf(sum)).toBe(8);
    expect(widthOf({ kind: 'extend', value: 1, from: 8, to: 32, signed: true })).toBe(32);
    expect(widthOf({ kind: 'bcd', operation: 'add', a: 1, b: 2, extra: 0 })).toBe(8);
  });
});

describe('widthAllowed', () => {
  it('lets a sum be any width, an extension more than 8 bits, a decimal byte none', () => {
    expect(widthAllowed(sum, 32)).toBe(true);
    const extend: NumberRequest = { kind: 'extend', value: 1, from: 8, to: 16, signed: true };
    expect(widthAllowed(extend, 8)).toBe(false);
    expect(widthAllowed(extend, 32)).toBe(true);
    expect(widthAllowed({ kind: 'bcd', operation: 'add', a: 1, b: 2, extra: 0 }, 8)).toBe(false);
  });
});

describe('sameOperation', () => {
  it('ignores the values put in', () => {
    expect(sameOperation(sum, { ...sum, a: 3, extra: 1 })).toBe(true);
  });

  it('tells another kind, width, or way of extending apart', () => {
    expect(sameOperation(sum, { ...sum, kind: 'subtract' })).toBe(false);
    expect(sameOperation(sum, { ...sum, width: 16 })).toBe(false);
    const extend: NumberRequest = { kind: 'extend', value: 1, from: 8, to: 32, signed: true };
    expect(sameOperation(extend, { ...extend, signed: false })).toBe(false);
  });
});

describe('changing a request', () => {
  it('flips one bit of an operand', () => {
    expect(withBitFlipped(sum, 'a', 7)).toMatchObject({ a: 0xff });
    expect(withBitFlipped(sum, 'b', 0)).toMatchObject({ b: 0 });
    expect(withBitFlipped({ kind: 'value', width: 32, bits: 0 }, 'a', 31)).toMatchObject({
      bits: 0x80000000
    });
  });

  it('keeps a new value to the bits the operand has', () => {
    expect(withOperand(sum, 'a', 0x1ff)).toMatchObject({ a: 0xff });
    expect(withOperand(sum, 'a', -1)).toMatchObject({ a: 0xff });
    const extend: NumberRequest = { kind: 'extend', value: 1, from: 8, to: 32, signed: true };
    expect(withOperand(extend, 'a', 0x180)).toMatchObject({ value: 0x80 });
  });

  it('flips the carry coming in', () => {
    expect(withExtraFlipped(sum)).toMatchObject({ extra: 1 });
  });
});

describe('freeView', () => {
  it('names the flags plainly', () => {
    expect(freeView(sum).flags.map((flag) => flag.flag)).toEqual([
      'Carry',
      'Overflow',
      'Zero',
      'Negative'
    ]);
    expect(freeView({ ...sum, kind: 'subtract' }).flags[0].flag).toBe('Borrow');
    expect(freeView({ kind: 'value', width: 8, bits: 0 }).flags).toEqual([]);
  });
});

describe('equationText', () => {
  it('writes each operation on one line', () => {
    expect(text(sum)).toBe('0x7F + 0x01 = 0x80');
    expect(text({ kind: 'subtract', width: 8, a: 3, b: 5, extra: 1 })).toBe(
      '0x03 − 0x05 − 1 = 0xFD'
    );
    expect(text({ kind: 'extend', value: 0x80, from: 8, to: 16, signed: true })).toBe(
      '0x80 → 0xFF80, copying the top bit'
    );
    expect(text({ kind: 'bcd', operation: 'add', a: 0x19, b: 0x03, extra: 0 })).toBe(
      '19 + 03 = 22 in decimal digits'
    );
    expect(text({ kind: 'value', width: 16, bits: 0x41 })).toBe('0x0041');
  });
});

describe('bitsOf', () => {
  it('lists the bits from bit 0', () => {
    expect(bitsOf(0b0110, 4)).toEqual([0, 1, 1, 0]);
    expect(bitsOf(0x80000000, 32)[31]).toBe(1);
  });
});
