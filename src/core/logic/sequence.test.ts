import { describe, expect, it } from 'vitest';
import { settle } from './feedback';
import { numberFrom, type Bit, type Circuit, type Signals } from './gates';
import { holding, REGISTER } from './register';
import { counter, SEQUENCE, shiftRegister } from './sequence';

const WIDTH = 4;

/** Flip-flops on one clock, worked by hand: set an input, raise the clock, lower it. */
function bench(circuit: Circuit, input: string) {
  let inputs: Record<string, Bit> = { [SEQUENCE.clock]: 0, [input]: 0 };
  let signals: Signals = holding(WIDTH, 0);
  const apply = (change: Record<string, Bit>): number => {
    inputs = { ...inputs, ...change };
    const next = settle(circuit, inputs, signals);
    expect(next.settled).toBe(true);
    signals = next.signals;
    return numberFrom(signals, REGISTER.q, WIDTH);
  };
  apply({});
  return {
    set: (value: Bit) => apply({ [input]: value }),
    rise: () => apply({ [SEQUENCE.clock]: 1 }),
    fall: () => apply({ [SEQUENCE.clock]: 0 }),
    tick() {
      this.rise();
      return this.fall();
    },
    wire: (name: string) => signals[name]
  };
}

describe('counter', () => {
  it('counts up at every clock edge, and wraps after its highest value', () => {
    const cells = bench(counter(WIDTH), SEQUENCE.count);
    cells.set(1);
    const seen = Array.from({ length: 17 }, () => cells.tick());
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0, 1]);
  });

  it('stands still while it is not told to count', () => {
    const cells = bench(counter(WIDTH), SEQUENCE.count);
    cells.set(1);
    cells.tick();
    cells.tick();
    cells.set(0);
    expect([cells.tick(), cells.tick()]).toEqual([2, 2]);
  });

  it('changes when the clock rises, and not when it falls', () => {
    const cells = bench(counter(WIDTH), SEQUENCE.count);
    cells.set(1);
    expect(cells.rise()).toBe(1);
    expect(cells.fall()).toBe(1);
  });

  it('flips a bit only when every bit below it is 1', () => {
    const cells = bench(counter(WIDTH), SEQUENCE.count);
    cells.set(1);
    for (let i = 0; i < 3; i++) cells.tick();
    // It holds 0011: bits 0, 1 and 2 will flip, bit 3 will not.
    expect([1, 2, 3].map((bit) => cells.wire(SEQUENCE.toggle(bit)))).toEqual([1, 1, 0]);
    expect(cells.tick()).toBe(4);
  });
});

describe('shiftRegister', () => {
  it('moves every bit one place up at a clock edge, and takes the input in at bit 0', () => {
    const cells = bench(shiftRegister(WIDTH), SEQUENCE.serial);
    cells.set(1);
    expect(cells.tick()).toBe(0b0001);
    cells.set(0);
    expect([cells.tick(), cells.tick(), cells.tick()]).toEqual([0b0010, 0b0100, 0b1000]);
  });

  it('drops the bit that leaves its top end', () => {
    const cells = bench(shiftRegister(WIDTH), SEQUENCE.serial);
    cells.set(1);
    for (let i = 0; i < 4; i++) cells.tick();
    cells.set(0);
    expect([cells.tick(), cells.tick(), cells.tick(), cells.tick()]).toEqual([14, 12, 8, 0]);
  });

  it('moves a bit one place a tick, never two', () => {
    const cells = bench(shiftRegister(WIDTH), SEQUENCE.serial);
    cells.set(1);
    expect(cells.rise()).toBe(1);
    expect(cells.fall()).toBe(1);
  });
});
