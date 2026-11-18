import { describe, expect, it } from 'vitest';
import {
  dragTarget,
  keyTarget,
  moveAmongVisible,
  sanitizeOrder,
  settleOffset,
  shiftFor,
  withMoved
} from './reorder';

const DEFAULTS = ['a', 'b', 'c', 'd'] as const;

describe('withMoved', () => {
  it('puts the key at its new index', () => {
    expect(withMoved(DEFAULTS, 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(withMoved(DEFAULTS, 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('keyTarget', () => {
  it('moves one place with the arrows and to either end with Home and End', () => {
    expect(keyTarget('ArrowUp', 2, 4)).toBe(1);
    expect(keyTarget('ArrowDown', 2, 4)).toBe(3);
    expect(keyTarget('Home', 2, 4)).toBe(0);
    expect(keyTarget('End', 2, 4)).toBe(3);
    expect(keyTarget('a', 2, 4)).toBeNull();
  });
});

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

describe('dragging a card', () => {
  // A tall card, a short one, then a very tall one, 16px apart.
  const GAP = 16;
  const slots = [
    { top: 0, height: 560 },
    { top: 576, height: 250 },
    { top: 842, height: 1000 }
  ];

  it('stays home until the leading edge reaches into a neighbour', () => {
    expect(dragTarget(slots, 0, 0)).toBe(0);
    // Bottom edge at 560 + 64 = 624 = 576 + 48: just short of the next card.
    expect(dragTarget(slots, 0, 64)).toBe(0);
    expect(dragTarget(slots, 0, 65)).toBe(1);
  });

  it('passes a tall card with a short move, not half of its height', () => {
    // The 1000px card is passed 48px into it, wherever its middle is.
    expect(dragTarget(slots, 1, 16 + 48 - 1)).toBe(1);
    expect(dragTarget(slots, 1, 16 + 48 + 1)).toBe(2);
  });

  it('needs half of a card shorter than twice the swap distance', () => {
    const short = [
      { top: 0, height: 100 },
      { top: 116, height: 60 }
    ];
    expect(dragTarget(short, 0, 16 + 30)).toBe(0);
    expect(dragTarget(short, 0, 16 + 31)).toBe(1);
  });

  it('can pass several cards in one drag, and go above the first one', () => {
    expect(dragTarget(slots, 0, 2000)).toBe(2);
    // The very tall last card, moved up past the short one and the tall first one.
    expect(dragTarget(slots, 2, -(842 - 560 + 48 + 1))).toBe(0);
    expect(dragTarget(slots, 2, -(842 - 826 + 48 + 1))).toBe(1);
  });

  it('slides the passed cards by the dragged card and the gap', () => {
    expect(shiftFor(slots, 0, 2, 1, GAP)).toBe(-576);
    expect(shiftFor(slots, 0, 2, 2, GAP)).toBe(-576);
    expect(shiftFor(slots, 2, 0, 0, GAP)).toBe(1016);
    expect(shiftFor(slots, 0, 1, 2, GAP)).toBe(0);
  });

  it('settles the dragged card past the cards it passed', () => {
    expect(settleOffset(slots, 0, 1, GAP)).toBe(266);
    expect(settleOffset(slots, 0, 2, GAP)).toBe(266 + 1016);
    expect(settleOffset(slots, 2, 0, GAP)).toBe(-(576 + 266));
    expect(settleOffset(slots, 1, 1, GAP)).toBe(0);
  });
});
