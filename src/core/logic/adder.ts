import type { Circuit, Gate } from './gates';

/**
 * The names of an adder's wires. Bit i adds `a` to `y`, which is `b` or, when `sub` is 1, its
 * inverse; `carry(i)` is the carry going into bit i, so `carry(width)` is the carry out.
 */
export const ADDER = {
  a: (bit: number) => `a${bit}`,
  b: (bit: number) => `b${bit}`,
  /** 1 turns the adder into a subtractor: every bit of b is inverted on its way in. */
  sub: 'sub',
  y: (bit: number) => `y${bit}`,
  /** a XOR y: the bit would pass a carry on. */
  propagate: (bit: number) => `p${bit}`,
  /** a AND y: the bit makes a carry by itself. */
  generate: (bit: number) => `g${bit}`,
  /** The carry coming in, passed on. */
  passed: (bit: number) => `t${bit}`,
  carry: (bit: number) => `c${bit}`,
  sum: (bit: number) => `s${bit}`
};

/** One bit of the adder: the XOR that may invert b, then a full adder of five gates. */
export function adderSlice(bit: number): Gate[] {
  const { a, b, sub, y, propagate, generate, passed, carry, sum } = ADDER;
  return [
    { id: y(bit), kind: 'xor', inputs: [b(bit), sub] },
    { id: propagate(bit), kind: 'xor', inputs: [a(bit), y(bit)] },
    { id: sum(bit), kind: 'xor', inputs: [propagate(bit), carry(bit)] },
    { id: generate(bit), kind: 'and', inputs: [a(bit), y(bit)] },
    { id: passed(bit), kind: 'and', inputs: [propagate(bit), carry(bit)] },
    { id: carry(bit + 1), kind: 'or', inputs: [generate(bit), passed(bit)] }
  ];
}

/**
 * A ripple-carry adder: each bit waits for the carry of the bit below it. With `sub` at 1 and a
 * carry in of 1 it computes a − b, as a + NOT b + 1.
 */
export function rippleAdder(width: number): Circuit {
  const bits = Array.from({ length: width }, (_, bit) => bit);
  return {
    inputs: [...bits.map(ADDER.a), ...bits.map(ADDER.b), ADDER.sub, ADDER.carry(0)],
    gates: bits.flatMap(adderSlice)
  };
}
