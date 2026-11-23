import { describe, expect, it } from 'vitest';
import { settle } from './feedback';
import { CELL, dLatch, flipFlop, holdingBit, srLatch } from './flipFlop';
import type { Bit, Circuit, Signals } from './gates';

const BITS: Bit[] = [0, 1];

/** Changes the inputs of a circuit and waits for it to come to rest. */
function drive(circuit: Circuit, inputs: Signals, held: Signals = {}): Signals {
  const { signals, settled } = settle(circuit, inputs, held);
  expect(settled).toBe(true);
  return signals;
}

describe('srLatch', () => {
  const latch = srLatch();

  it('sets, resets and keeps its bit', () => {
    const set = drive(latch, { s: 1, r: 0 });
    expect(set[CELL.q]).toBe(1);
    expect(drive(latch, { s: 0, r: 0 }, set)[CELL.q]).toBe(1);
    const reset = drive(latch, { s: 0, r: 1 }, set);
    expect(reset[CELL.q]).toBe(0);
    expect(drive(latch, { s: 0, r: 0 }, reset)[CELL.q]).toBe(0);
  });

  it('always has q and its inverse apart, except with both inputs at 1', () => {
    const set = drive(latch, { s: 1, r: 0 });
    expect(set[CELL.notQ]).toBe(0);
    const both = drive(latch, { s: 1, r: 1 }, set);
    expect([both[CELL.q], both[CELL.notQ]]).toEqual([0, 0]);
  });
});

describe('dLatch', () => {
  const latch = dLatch();

  it.each(BITS)('follows its data while enabled, and keeps %i afterwards', (bit) => {
    const open = drive(latch, { d: bit, e: 1 });
    expect(open[CELL.q]).toBe(bit);
    const closed = drive(latch, { d: bit, e: 0 }, open);
    const other = bit ? 0 : 1;
    expect(drive(latch, { d: other, e: 0 }, closed)[CELL.q]).toBe(bit);
  });

  it('follows a change of data while it is open', () => {
    const one = drive(latch, { d: 1, e: 1 });
    expect(drive(latch, { d: 0, e: 1 }, one)[CELL.q]).toBe(0);
  });
});

describe('flipFlop', () => {
  const cell = flipFlop();

  /** A flip-flop holding `bit`, its clock low and `data` waiting at its input. */
  function holding(bit: Bit, data: Bit): Signals {
    const low = drive(cell, { d: bit, clk: 0 }, holdingBit(0));
    const loaded = drive(cell, { d: bit, clk: 1 }, low);
    return drive(cell, { d: data, clk: 0 }, drive(cell, { d: bit, clk: 0 }, loaded));
  }

  it('cannot come to rest before it has ever held a bit', () => {
    expect(settle(cell, { d: 0, clk: 0 }).settled).toBe(false);
  });

  // Every bit it can hold, with every bit that can wait at its input.
  const cases = BITS.flatMap((bit) => BITS.map((data) => [bit, data] as const));

  it.each(cases)('holding %i with %i waiting: takes the data as the clock rises', (bit, data) => {
    const low = holding(bit, data);
    expect(low[CELL.q]).toBe(bit);
    expect(drive(cell, { d: data, clk: 1 }, low)[CELL.q]).toBe(data);
  });

  it.each(cases)('holding %i with %i waiting: ignores the data at any other time', (bit, data) => {
    const low = holding(bit, bit);
    // The clock low: the data changes, and nothing reaches q.
    const waiting = drive(cell, { d: data, clk: 0 }, low);
    expect(waiting[CELL.q]).toBe(bit);
    // The clock high: the bit is in, and a later change of the data does not follow it.
    const high = drive(cell, { d: bit, clk: 1 }, low);
    const changed = drive(cell, { d: data, clk: 1 }, high);
    expect(changed[CELL.q]).toBe(bit);
    // The clock falling takes nothing in either.
    expect(drive(cell, { d: data, clk: 0 }, changed)[CELL.q]).toBe(bit);
  });
});
