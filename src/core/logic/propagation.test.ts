import { describe, expect, it } from 'vitest';
import { ADDER, rippleAdder } from './adder';
import { solve, type AdderRequest, type AluSolution, type Width } from './alu';
import { bitOf, type Bit, type Signals } from './gates';
import { atRest, depth, propagate } from './propagation';

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

const WIDTHS = [8, 16, 32] as const;

function allOnes(width: number): number {
  return width === 32 ? 0xffffffff : 2 ** width - 1;
}

/** The values on a solved circuit's inputs. */
function inputsOf(solution: AluSolution): Signals {
  return Object.fromEntries(solution.circuit.inputs.map((name) => [name, solution.signals[name]]));
}

function adderInputs(width: number, a: number, b: number, carryIn: Bit = 0): Signals {
  const inputs: Record<string, Bit> = { [ADDER.sub]: 0, [ADDER.carry(0)]: carryIn };
  for (let bit = 0; bit < width; bit++) {
    inputs[ADDER.a(bit)] = bitOf(a, bit);
    inputs[ADDER.b(bit)] = bitOf(b, bit);
  }
  return inputs;
}

function randomRequest(width: Width, next: () => number): AdderRequest {
  return {
    kind: next() % 2 ? 'add' : 'subtract',
    width,
    a: (next() & allOnes(width)) >>> 0,
    b: (next() & allOnes(width)) >>> 0,
    carryIn: (next() % 2) as Bit
  };
}

describe('propagate', () => {
  it.each(WIDTHS)('comes to rest at what the %i-bit circuit works out', (width) => {
    const next = random(width * 7919);
    for (let round = 0; round < 40; round++) {
      const before = solve(randomRequest(width, next));
      const after = solve(randomRequest(width, next));
      const { steps } = propagate(after.circuit, inputsOf(after), before.signals);
      expect(steps.at(-1)).toEqual(after.signals);
      expect(steps.length - 1).toBeLessThanOrEqual(depth(after.circuit));
    }
  });

  it('starts with the new inputs on gates that have not reacted yet', () => {
    const circuit = rippleAdder(8);
    const held = atRest(circuit);
    const inputs = adderInputs(8, 0xff, 1);
    const { steps } = propagate(circuit, inputs, held);
    expect(steps[0]).toEqual({ ...held, ...inputs });
  });

  it('takes no time when the inputs did not change', () => {
    const solution = solve({ kind: 'add', width: 8, a: 0x5a, b: 0x33, carryIn: 0 });
    const { steps, readyAt } = propagate(solution.circuit, inputsOf(solution), solution.signals);
    expect(steps).toHaveLength(1);
    expect(Object.values(readyAt).every((step) => step === 0)).toBe(true);
  });

  it.each(WIDTHS)('lets a carry climb the %i-bit adder two gate delays a bit', (width) => {
    const circuit = rippleAdder(width);
    const { steps, readyAt } = propagate(
      circuit,
      adderInputs(width, allOnes(width), 1),
      atRest(circuit)
    );
    for (let bit = 1; bit < width; bit++) {
      expect(readyAt[ADDER.carry(bit + 1)] - readyAt[ADDER.carry(bit)]).toBe(2);
    }
    const last = Math.max(...Object.values(readyAt));
    expect(readyAt[ADDER.carry(width)]).toBe(last);
    expect(steps.length - 1).toBe(last);
  });

  it.each(WIDTHS)('adds 0 to a %i-bit number in the same two gate delays', (width) => {
    const circuit = rippleAdder(width);
    const { steps } = propagate(circuit, adderInputs(width, allOnes(width), 0), atRest(circuit));
    expect(steps.length - 1).toBe(2);
  });

  it('shows a sum bit wrong on the way to the answer', () => {
    const circuit = rippleAdder(8);
    const { steps } = propagate(circuit, adderInputs(8, 0xff, 1), atRest(circuit));
    const top = steps.map((signals) => signals[ADDER.sum(7)]);
    expect(top[0]).toBe(0);
    expect(top).toContain(1);
    expect(top.at(-1)).toBe(0);
  });

  it('refuses a circuit whose gates read one another in a loop', () => {
    const loop = { inputs: [], gates: [{ id: 'q', kind: 'not' as const, inputs: ['q'] }] };
    expect(() => propagate(loop, {}, { q: 0 })).toThrow(/before it is driven/);
  });
});

describe('atRest', () => {
  it('is the circuit with every input at 0', () => {
    const solution = solve({ kind: 'add', width: 8, a: 0, b: 0, carryIn: 0 });
    expect(atRest(solution.circuit)).toEqual(solution.signals);
  });
});

describe('depth', () => {
  it('is 0 for a circuit with no gates', () => {
    expect(depth({ inputs: ['a'], gates: [] })).toBe(0);
  });

  it.each(WIDTHS)('grows by two gates for every bit of a %i-bit ripple adder', (width) => {
    expect(depth(rippleAdder(width))).toBe(2 * width + 2);
  });

  it.each(WIDTHS)('is how long 0 − 0 takes a %i-bit adder at rest', (width) => {
    const circuit = rippleAdder(width);
    // Every bit of B has to be inverted before it can pass on the carry that comes in.
    const inputs = { ...adderInputs(width, 0, 0, 1), [ADDER.sub]: 1 as Bit };
    const { steps } = propagate(circuit, inputs, atRest(circuit));
    expect(steps.length - 1).toBe(depth(circuit));
  });
});
