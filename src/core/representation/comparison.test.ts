import { describe, expect, it } from 'vitest';
import { compare, holds, type Order, type Relation } from './comparison';

describe('compare', () => {
  it('reads both numbers on each scale', () => {
    const { unsigned, signed } = compare(0xff, 0x01, 8);
    expect(unsigned).toEqual({ scale: 'unsigned', a: 255, b: 1, order: 'greater' });
    expect(signed).toEqual({ scale: 'signed', a: -1, b: 1, order: 'less' });
  });

  it('puts two numbers of one sign in the same order on both scales', () => {
    expect(compare(3, 5, 8).unsigned.order).toBe('less');
    expect(compare(3, 5, 8).signed.order).toBe('less');
    expect(compare(0x90, 0x85, 8).unsigned.order).toBe('greater');
    expect(compare(0x90, 0x85, 8).signed.order).toBe('greater');
  });

  it('finds equal bits equal on both scales', () => {
    expect(compare(0x8000, 0x8000, 16).unsigned.order).toBe('equal');
    expect(compare(0x8000, 0x8000, 16).signed.order).toBe('equal');
  });

  it('compares 32 bits without losing the top one', () => {
    const { unsigned, signed } = compare(0x80000000, 0x7fffffff, 32);
    expect(unsigned.order).toBe('greater');
    expect(signed).toMatchObject({ a: -2147483648, b: 2147483647, order: 'less' });
  });

  it('keeps only the bits of the width', () => {
    expect(compare(0x1ff, 0xff, 8).unsigned.order).toBe('equal');
  });
});

describe('holds', () => {
  const YES: Record<Relation, Order[]> = {
    equal: ['equal'],
    notEqual: ['less', 'greater'],
    less: ['less'],
    lessOrEqual: ['less', 'equal'],
    greater: ['greater'],
    greaterOrEqual: ['greater', 'equal']
  };

  it.each(Object.keys(YES) as Relation[])('%s', (relation) => {
    for (const order of ['less', 'equal', 'greater'] as const) {
      expect(holds(order, relation)).toBe(YES[relation].includes(order));
    }
  });
});
