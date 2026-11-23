import { describe, expect, it } from 'vitest';
import { settle } from './feedback';
import type { Circuit } from './gates';

/** Two NOR gates, each reading the other: the smallest circuit that remembers. */
const latch: Circuit = {
  inputs: ['s', 'r'],
  gates: [
    { id: 'q', kind: 'nor', inputs: ['r', 'nq'] },
    { id: 'nq', kind: 'nor', inputs: ['s', 'q'] }
  ]
};

describe('settle', () => {
  it('lets a loop come to rest', () => {
    const set = settle(latch, { s: 1, r: 0 });
    expect(set.settled).toBe(true);
    expect(set.signals).toMatchObject({ q: 1, nq: 0 });
  });

  it('starts from what the gates held', () => {
    const set = settle(latch, { s: 1, r: 0 });
    const kept = settle(latch, { s: 0, r: 0 }, set.signals);
    expect(kept.settled).toBe(true);
    expect(kept.signals).toMatchObject({ q: 1, nq: 0 });

    const reset = settle(latch, { s: 0, r: 1 }, kept.signals);
    expect(reset.signals).toMatchObject({ q: 0, nq: 1 });
    expect(settle(latch, { s: 0, r: 0 }, reset.signals).signals).toMatchObject({ q: 0, nq: 1 });
  });

  it('reports a circuit that never comes to rest', () => {
    const both = settle(latch, { s: 1, r: 1 });
    expect(both.settled).toBe(true);
    expect(both.signals).toMatchObject({ q: 0, nq: 0 });
    // Both inputs let go at once: each gate waits for the other, for ever.
    expect(settle(latch, { s: 0, r: 0 }, both.signals).settled).toBe(false);
  });

  it('refuses an input left without a value', () => {
    expect(() => settle(latch, { s: 1 })).toThrow('r');
  });

  it('refuses a gate that reads a wire nothing drives', () => {
    const broken: Circuit = { inputs: [], gates: [{ id: 'out', kind: 'not', inputs: ['in'] }] };
    expect(() => settle(broken, {})).toThrow('in');
  });
});
