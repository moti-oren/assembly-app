import { describe, expect, it } from 'vitest';
import { ADDER, rippleAdder } from './adder';
import { withStuck } from './fault';
import { evaluate, type Bit, type Circuit, type Signals } from './gates';
import { atRest, depth, propagate } from './propagation';

const WIDTH = 4;
const adder = rippleAdder(WIDTH);

function inputsOf(a: number, b: number): Signals {
  const inputs: Record<string, Bit> = { [ADDER.sub]: 0, [ADDER.carry(0)]: 0 };
  for (let bit = 0; bit < WIDTH; bit++) {
    inputs[ADDER.a(bit)] = ((a >> bit) & 1) as Bit;
    inputs[ADDER.b(bit)] = ((b >> bit) & 1) as Bit;
  }
  return inputs;
}

function sumOf(circuit: Circuit, a: number, b: number): number {
  const signals = evaluate(circuit, inputsOf(a, b));
  let sum = 0;
  for (let bit = 0; bit < WIDTH; bit++) sum += signals[ADDER.sum(bit)] << bit;
  return sum + (signals[ADDER.carry(WIDTH)] << WIDTH);
}

describe('withStuck', () => {
  it('leaves a circuit with no fault as it is', () => {
    expect(withStuck(adder, {})).toBe(adder);
  });

  it('holds the gate at its value, whatever its inputs', () => {
    const broken = withStuck(adder, { [ADDER.sum(0)]: 1 });
    for (const [a, b] of [
      [0, 0],
      [1, 0],
      [1, 1]
    ]) {
      expect(evaluate(broken, inputsOf(a, b))[ADDER.sum(0)]).toBe(1);
    }
  });

  it('lets the gates after it read the stuck value', () => {
    // 3 + 1 carries out of bit 0 and bit 1. With bit 0's carry stuck at 0 it never starts.
    const broken = withStuck(adder, { [ADDER.carry(1)]: 0 });
    expect(sumOf(adder, 3, 1)).toBe(4);
    expect(sumOf(broken, 3, 1)).toBe(2);
  });

  it('changes no wire when the gate would put out that value anyway', () => {
    const inputs = inputsOf(2, 4);
    const healthy = evaluate(adder, inputs);
    const broken = withStuck(adder, { [ADDER.carry(1)]: healthy[ADDER.carry(1)] });
    expect(evaluate(broken, inputs)).toEqual(healthy);
  });

  it('takes several faults at once', () => {
    const broken = withStuck(adder, { [ADDER.sum(0)]: 1, [ADDER.sum(3)]: 1 });
    expect(sumOf(broken, 0, 0)).toBe(0b1001);
  });

  it('refuses a name no gate drives', () => {
    expect(() => withStuck(adder, { nothing: 1 })).toThrow('No gate of the circuit drives');
    expect(() => withStuck(adder, { [ADDER.a(0)]: 1 })).toThrow('No gate of the circuit drives');
  });
});

describe('a broken circuit through time', () => {
  it('is no deeper than the working one', () => {
    const broken = withStuck(adder, { [ADDER.carry(2)]: 1 });
    expect(depth(broken)).toBeLessThanOrEqual(depth(adder));
  });

  it('comes to rest at what evaluate gives', () => {
    const broken = withStuck(adder, { [ADDER.carry(1)]: 1 });
    const inputs = inputsOf(5, 2);
    const { steps } = propagate(broken, inputs, atRest(adder));
    expect(steps[steps.length - 1]).toEqual(evaluate(broken, inputs));
  });

  it('spreads from the gate that broke, a gate delay at a time', () => {
    const inputs = inputsOf(0, 0);
    const held = evaluate(adder, inputs);
    const broken = withStuck(adder, { [ADDER.carry(1)]: 1 });
    const { readyAt } = propagate(broken, inputs, held);
    expect(readyAt[ADDER.carry(1)]).toBe(1);
    expect(readyAt[ADDER.sum(1)]).toBe(2);
    expect(readyAt[ADDER.sum(0)]).toBe(0);
  });
});
