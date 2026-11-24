import { describe, expect, it } from 'vitest';
import type { AluRequest, ShiftRequest } from '@/core/logic/alu';
import { repeatedStages } from '@/core/logic/shifter';
import {
  circuitLesson,
  circuitTitle,
  equationText,
  freeCircuit,
  freeRequest,
  hexOf,
  logicSections,
  operationOf,
  sameCircuit,
  shiftCount,
  unavailableText,
  withBitFlipped,
  withCarryInFlipped,
  withStageFlipped
} from './logicView';

const add: AluRequest = { kind: 'add', width: 16, a: 0x7fff, b: 1, carryIn: 0 };
const shift: ShiftRequest = {
  kind: 'shift',
  width: 8,
  value: 0x81,
  direction: 'left',
  fill: 'zero',
  carryIn: 0,
  stages: repeatedStages(2)
};

describe('freeRequest', () => {
  it('starts from values to try', () => {
    expect(freeRequest('add', 8, null)).toEqual({
      kind: 'add',
      width: 8,
      a: 0x56,
      b: 0x33,
      carryIn: 0
    });
  });

  it('keeps the operands when the operation changes, and feeds a subtraction its carry', () => {
    expect(freeRequest('subtract', 16, add)).toEqual({ ...add, kind: 'subtract', carryIn: 1 });
  });

  it('cuts the operands down to a narrower width, and keeps 32 bits unsigned', () => {
    expect(freeRequest('and', 8, add)).toMatchObject({ a: 0xff, b: 1 });
    const wide: AluRequest = { kind: 'or', width: 32, a: 0xffffffff, b: 0 };
    expect(freeRequest('xor', 32, wide)).toMatchObject({ a: 0xffffffff });
  });

  it('makes a shift of the first operand, by one place', () => {
    const made = freeRequest('shiftRight', 8, add) as ShiftRequest;
    expect(made).toMatchObject({ kind: 'shift', value: 0xff, direction: 'right', fill: 'zero' });
    expect(shiftCount(made)).toBe(1);
  });
});

describe('operationOf', () => {
  it('names the operations the page offers', () => {
    expect(operationOf(add)).toBe('add');
    expect(operationOf(shift)).toBe('shiftLeft');
  });

  it('has no name for a shift only a CPU makes', () => {
    expect(operationOf({ ...shift, fill: 'rotate' })).toBeNull();
  });
});

describe('freeCircuit', () => {
  it('names the flags plainly', () => {
    expect(freeCircuit(add).taps.map((tap) => tap.flag)).toEqual([
      'Carry out',
      'Overflow',
      'Zero',
      'Negative'
    ]);
    expect(freeCircuit(shift).taps.map((tap) => tap.flag)).toEqual(['Carry', 'Zero', 'Negative']);
    expect(freeCircuit({ kind: 'and', width: 8, a: 0, b: 0 }).taps).toHaveLength(2);
  });
});

describe('sameCircuit', () => {
  it('ignores the values on the inputs', () => {
    expect(sameCircuit(add, { ...add, a: 0, carryIn: 1 })).toBe(true);
    expect(sameCircuit(shift, withStageFlipped(shift, 0))).toBe(true);
  });

  it('tells another operation, width or shifter apart', () => {
    expect(sameCircuit(add, { ...add, kind: 'subtract' })).toBe(false);
    expect(sameCircuit(add, { ...add, width: 8 })).toBe(false);
    expect(sameCircuit(shift, { ...shift, direction: 'right' })).toBe(false);
    expect(sameCircuit(shift, { ...shift, stages: repeatedStages(3) })).toBe(false);
  });
});

describe('edits', () => {
  it('flips one bit of an operand', () => {
    expect(withBitFlipped(add, 'a', 15)).toMatchObject({ a: 0xffff, b: 1 });
    expect(withBitFlipped(add, 'b', 0)).toMatchObject({ a: 0x7fff, b: 0 });
    expect(withBitFlipped(shift, 'a', 1)).toMatchObject({ value: 0x83 });
  });

  it('flips bit 31 without going negative', () => {
    const wide: AluRequest = { kind: 'add', width: 32, a: 0, b: 0, carryIn: 0 };
    expect(withBitFlipped(wide, 'a', 31)).toMatchObject({ a: 0x80000000 });
  });

  it('flips the carry in, where there is one', () => {
    expect(withCarryInFlipped(add)).toMatchObject({ carryIn: 1 });
    const and: AluRequest = { kind: 'and', width: 8, a: 0, b: 0 };
    expect(withCarryInFlipped(and)).toBe(and);
  });

  it('switches one row of a shifter', () => {
    expect(withStageFlipped(shift, 1).stages.map((stage) => stage.on)).toEqual([1, 0]);
  });
});

describe('text', () => {
  it('writes values as hex of the circuit’s width', () => {
    expect(hexOf(0x2a, 16)).toBe('0x002A');
    expect(hexOf(0xffffffff, 32)).toBe('0xFFFFFFFF');
  });

  it('writes the operation on one line', () => {
    expect(equationText(add, 0x8000)).toBe('0x7FFF + 0x0001 = 0x8000');
    expect(equationText({ ...add, carryIn: 1 }, 0x8001)).toBe('0x7FFF + 0x0001 + 1 = 0x8001');
    expect(equationText({ kind: 'subtract', width: 8, a: 5, b: 3, carryIn: 0 }, 1)).toBe(
      '0x05 − 0x03 − 1 = 0x01'
    );
    expect(equationText({ kind: 'xor', width: 8, a: 5, b: 3 }, 6)).toBe('0x05 XOR 0x03 = 0x06');
    expect(equationText(shift, 4)).toBe('0x81 << 2 = 0x04');
    expect(equationText({ ...shift, fill: 'rotate' }, 6)).toBe('0x81 rotated left by 2 = 0x06');
  });

  it('names the circuit', () => {
    expect(circuitTitle(add)).toBe('16-bit adder');
    expect(circuitTitle({ kind: 'or', width: 8, a: 0, b: 0 })).toBe('8 OR gates');
  });
});

describe('unavailableText', () => {
  it('says why an instruction has no circuit, and what the circuit on show is', () => {
    expect(unavailableText({ unavailable: 'Multiplication has no circuit here.' })).toBe(
      'Multiplication has no circuit here. The circuit on show is one to try by hand.'
    );
  });

  it('has nothing to say before an instruction ran', () => {
    expect(unavailableText(null)).toBeNull();
  });
});

describe('logicSections', () => {
  it('gives the gate picked a section beside the drawing', () => {
    expect(logicSections(false, true).map((each) => each.id)).toEqual(['circuit', 'gate', 'flags']);
  });

  it('leaves the gate picked under its truth table on a phone', () => {
    expect(logicSections(true, true).map((each) => each.id)).toEqual(['circuit', 'flags']);
  });

  it('names the flags for a circuit that follows the CPU, and for one that does not', () => {
    expect(logicSections(false, true).at(-1)?.label).toBe('Where each flag comes from');
    expect(logicSections(false, false).at(-1)?.label).toBe('What the circuit can also tell');
  });
});

describe('circuitLesson', () => {
  it('says the carry in adds 1 only when it is 1', () => {
    const subtract: AluRequest = { kind: 'subtract', width: 8, a: 0xfe, b: 1, carryIn: 1 };
    expect(circuitLesson(subtract)).toContain('the carry in adds 1');
    const borrow = circuitLesson({ ...subtract, carryIn: 0 });
    expect(borrow).not.toContain('the carry in adds 1');
    expect(borrow).toContain('here it is 0');
  });
});
