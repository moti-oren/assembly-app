import { describe, expect, it } from 'vitest';
import { solveNumber, type NumberRequest } from '@/core/representation/request';
import type { ScalingRequest } from '@/core/representation/scaling';
import {
  bitsOf,
  disallowedWidths,
  equationText,
  freeRequest,
  freeView,
  sameOperation,
  unavailableText,
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

describe('the shift lens', () => {
  const shift: ScalingRequest = {
    kind: 'shift',
    width: 8,
    value: 0x7f,
    direction: 'left',
    fill: 'zero',
    count: 1
  };

  it('starts as one place to the left, from the value on show', () => {
    expect(freeRequest('shift', 8, null)).toEqual(shift);
    expect(
      freeRequest('shift', 16, { kind: 'add', width: 16, a: 0x1234, b: 1, extra: 0 })
    ).toMatchObject({
      value: 0x1234
    });
  });

  it('keeps its direction, fill and places across a change of width', () => {
    const wide = { ...shift, width: 32, direction: 'right', fill: 'sign', count: 20 } as const;
    expect(freeRequest('shift', 8, wide)).toMatchObject({
      direction: 'right',
      fill: 'sign',
      count: 8
    });
  });

  it('notes the carry and the overflow after one place only', () => {
    const names = (request: ScalingRequest) => freeView(request).flags.map((flag) => flag.flag);
    expect(names(shift)).toEqual(['Carry', 'Overflow', 'Zero', 'Negative']);
    expect(names({ ...shift, direction: 'right' })).toEqual(['Carry', 'Zero', 'Negative']);
    expect(names({ ...shift, count: 2 })).toEqual(['Zero', 'Negative']);
  });

  it('is another operation once its direction, fill or places change', () => {
    expect(sameOperation(shift, { ...shift, value: 3 })).toBe(true);
    expect(sameOperation(shift, { ...shift, count: 2 })).toBe(false);
    expect(sameOperation(shift, { ...shift, direction: 'right' })).toBe(false);
    expect(
      sameOperation(
        { ...shift, direction: 'right' },
        { ...shift, direction: 'right', fill: 'sign' }
      )
    ).toBe(false);
  });

  it('flips a bit of its value', () => {
    expect(withBitFlipped(shift, 'a', 7)).toMatchObject({ value: 0xff });
  });

  it('writes the shift on one line', () => {
    const text = (request: ScalingRequest) => equationText(request, solveNumber(request));
    expect(text(shift)).toBe('0x7F << 1 = 0xFE');
    expect(text({ ...shift, value: 0xf9, direction: 'right', fill: 'sign' })).toBe(
      '0xF9 >> 1 = 0xFC, copying the top bit'
    );
  });
});

describe('unavailableText', () => {
  it('says why an instruction has no numbers, and what the numbers on show are', () => {
    expect(unavailableText({ unavailable: 'A rotate is not arithmetic.' })).toBe(
      'A rotate is not arithmetic. The numbers on show are ones to try by hand.'
    );
  });

  it('has nothing to say before an instruction ran', () => {
    expect(unavailableText(null)).toBeNull();
  });
});

describe('disallowedWidths', () => {
  it('lets a sum be any width', () => {
    expect(disallowedWidths(sum)).toEqual([]);
  });

  it('keeps a decimal byte at its one width', () => {
    expect(disallowedWidths(freeRequest('bcd', 8, null))).toEqual([8, 16, 32]);
  });

  it('does not let an extension be as narrow as what it extends', () => {
    expect(disallowedWidths(freeRequest('extend', 16, null))).toEqual([8]);
  });
});
