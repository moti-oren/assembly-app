import { describe, expect, it } from 'vitest';
import { moveAmongVisible, sanitizeOrder } from './reorder';

const DEFAULTS = ['a', 'b', 'c', 'd'] as const;

describe('sanitizeOrder', () => {
  it('keeps a valid stored order', () => {
    expect(sanitizeOrder(['d', 'c', 'b', 'a'], DEFAULTS)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('drops unknown and repeated keys, and appends missing ones in default order', () => {
    expect(sanitizeOrder(['c', 'x', 'c', 'a'], DEFAULTS)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('falls back to the defaults for anything that is not a list', () => {
    expect(sanitizeOrder('nonsense', DEFAULTS)).toEqual(['a', 'b', 'c', 'd']);
    expect(sanitizeOrder(null, DEFAULTS)).toEqual(['a', 'b', 'c', 'd']);
    expect(sanitizeOrder([1, {}, 'b'], DEFAULTS)).toEqual(['b', 'a', 'c', 'd']);
  });
});

describe('moveAmongVisible', () => {
  it('moves within a fully visible list', () => {
    expect(moveAmongVisible(DEFAULTS, DEFAULTS, 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveAmongVisible(DEFAULTS, DEFAULTS, 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveAmongVisible(DEFAULTS, DEFAULTS, 'b', 3)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('places the card before the visible card it lands on, past hidden ones', () => {
    // c is hidden: visible a, b, d. Moving a to visible position 1 (b, a, d) puts it before d.
    expect(moveAmongVisible(DEFAULTS, ['a', 'b', 'd'], 'a', 1)).toEqual(['b', 'c', 'a', 'd']);
    // To the end (b, d, a): after d.
    expect(moveAmongVisible(DEFAULTS, ['a', 'b', 'd'], 'a', 2)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('keeps a hidden card after the last visible one in its place', () => {
    // d is hidden: moving a to the end of a, b, c puts it right after c, before d.
    expect(moveAmongVisible(DEFAULTS, ['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('leaves the order alone when the card does not move', () => {
    expect(moveAmongVisible(DEFAULTS, DEFAULTS, 'b', 1)).toEqual(['a', 'b', 'c', 'd']);
  });
});
