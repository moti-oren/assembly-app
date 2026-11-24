import { CELL, flipFlopGates } from './flipFlop';
import type { Circuit, Gate } from './gates';
import { REGISTER } from './register';

/**
 * The names of the wires of flip-flops that feed one another; each flip-flop's own are those of
 * `REGISTER`, by its bit.
 */
export const SEQUENCE = {
  clock: CELL.clock,
  /** The bit that comes into a shift register at its low end. */
  serial: 'in',
  /** 1 lets a counter count at the next clock edge; at 0 it stands still. */
  count: 'en',
  /** 1 when a counter's bit will flip at the next clock edge: every bit below it is 1. */
  toggle: (bit: number) => (bit === 0 ? SEQUENCE.count : `t${bit}`)
};

const clockInverter: Gate = { id: CELL.notClock, kind: 'not', inputs: [CELL.clock] };

function bitsOf(width: number): number[] {
  return Array.from({ length: width }, (_, bit) => bit);
}

/**
 * A shift register: every flip-flop's input is the output of the one below it, with no gate
 * between them, so each clock edge moves every bit one place up and takes a new one in at bit 0.
 */
export function shiftRegister(width: number): Circuit {
  return {
    inputs: [SEQUENCE.clock, SEQUENCE.serial],
    gates: [
      clockInverter,
      ...bitsOf(width).flatMap((bit) =>
        flipFlopGates(
          (wire) => REGISTER.wire(wire, bit),
          bit === 0 ? SEQUENCE.serial : REGISTER.q(bit - 1)
        )
      )
    ]
  };
}

/**
 * One bit of a counter: it flips when every bit below it is 1, which an AND gate hands up from
 * bit to bit, and an XOR gate turns "flip" into the bit to take in.
 */
function counterBit(bit: number): Gate[] {
  const data = REGISTER.data(bit);
  const carry: Gate[] =
    bit === 0
      ? []
      : [
          {
            id: SEQUENCE.toggle(bit),
            kind: 'and',
            inputs: [SEQUENCE.toggle(bit - 1), REGISTER.q(bit - 1)]
          }
        ];
  return [
    ...carry,
    { id: data, kind: 'xor', inputs: [REGISTER.q(bit), SEQUENCE.toggle(bit)] },
    ...flipFlopGates((wire) => REGISTER.wire(wire, bit), data)
  ];
}

/** A counter: flip-flops whose inputs are their own value plus one, so each clock edge counts. */
export function counter(width: number): Circuit {
  return {
    inputs: [SEQUENCE.clock, SEQUENCE.count],
    gates: [clockInverter, ...bitsOf(width).flatMap(counterBit)]
  };
}
