import { describe, expect, it } from 'vitest';
import { ADDER } from './adder';
import { solve, tapValue, type AluRequest, type Tap } from './alu';
import { barrelStages, repeatedStages, SHIFTER, type ShiftFill } from './shifter';

function taps(request: AluRequest, names: Tap[]): Record<string, number | null> {
  const solution = solve(request);
  return Object.fromEntries(names.map((name) => [name, tapValue(solution, name)]));
}

describe('solve: addition and subtraction', () => {
  it('adds, and carries out of the top bit', () => {
    const request: AluRequest = { kind: 'add', width: 8, a: 0xf0, b: 0x20, carryIn: 0 };
    expect(solve(request).result).toBe(0x10);
    expect(taps(request, ['carryOut', 'overflow', 'zero', 'negative'])).toEqual({
      carryOut: 1,
      overflow: 0,
      zero: 0,
      negative: 0
    });
  });

  it('flags a signed overflow when the two top carries disagree', () => {
    const request: AluRequest = { kind: 'add', width: 16, a: 0x7fff, b: 1, carryIn: 0 };
    expect(solve(request).result).toBe(0x8000);
    expect(taps(request, ['carryOut', 'overflow', 'negative'])).toEqual({
      carryOut: 0,
      overflow: 1,
      negative: 1
    });
  });

  it('gives the half carry out of bit 3', () => {
    expect(taps({ kind: 'add', width: 8, a: 0x0f, b: 1, carryIn: 0 }, ['halfCarry'])).toEqual({
      halfCarry: 1
    });
  });

  it('subtracts, leaving no carry out when it had to borrow', () => {
    const request: AluRequest = { kind: 'subtract', width: 8, a: 3, b: 5, carryIn: 1 };
    expect(solve(request).result).toBe(0xfe);
    expect(taps(request, ['carryOut', 'less'])).toEqual({ carryOut: 0, less: 1 });
  });

  it('compares signed numbers through overflow: -128 < 1', () => {
    const request: AluRequest = { kind: 'subtract', width: 8, a: 0x80, b: 1, carryIn: 1 };
    expect(taps(request, ['negative', 'overflow', 'less'])).toEqual({
      negative: 0,
      overflow: 1,
      less: 1
    });
  });

  it('agrees with 32-bit arithmetic on random operands', () => {
    let seed = 12345;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    for (let i = 0; i < 200; i++) {
      const a = next();
      const b = next();
      expect(solve({ kind: 'add', width: 32, a, b, carryIn: 0 }).result).toBe((a + b) >>> 0);
      expect(solve({ kind: 'subtract', width: 32, a, b, carryIn: 1 }).result).toBe((a - b) >>> 0);
    }
  });
});

describe('solve: logic', () => {
  it('works on each bit by itself', () => {
    expect(solve({ kind: 'and', width: 8, a: 0b1100, b: 0b1010 }).result).toBe(0b1000);
    expect(solve({ kind: 'or', width: 8, a: 0b1100, b: 0b1010 }).result).toBe(0b1110);
    expect(solve({ kind: 'xor', width: 8, a: 0b1100, b: 0b1010 }).result).toBe(0b0110);
  });

  it('has no carry to tap', () => {
    expect(tapValue(solve({ kind: 'and', width: 8, a: 1, b: 1 }), 'carryOut')).toBeNull();
  });

  it('sets zero and an even parity for a result of 0', () => {
    expect(taps({ kind: 'xor', width: 16, a: 0x1234, b: 0x1234 }, ['zero', 'parity'])).toEqual({
      zero: 1,
      parity: 1
    });
  });

  it('takes parity from the low byte only', () => {
    expect(taps({ kind: 'or', width: 16, a: 0x0100, b: 0x0003 }, ['parity'])).toEqual({
      parity: 1
    });
  });
});

describe('solve: shifts', () => {
  const shift = (
    value: number,
    direction: 'left' | 'right',
    fill: ShiftFill,
    count: number,
    carryIn: 0 | 1 = 0
  ): AluRequest => ({
    kind: 'shift',
    width: 8,
    value,
    direction,
    fill,
    carryIn,
    stages: repeatedStages(count)
  });

  it('shifts left, the last bit out going to the carry', () => {
    const request = shift(0b1100_0001, 'left', 'zero', 2);
    expect(solve(request).result).toBe(0b0000_0100);
    expect(taps(request, ['carry'])).toEqual({ carry: 1 });
  });

  it('keeps the sign on an arithmetic right shift', () => {
    expect(solve(shift(0b1000_0100, 'right', 'sign', 2)).result).toBe(0b1110_0001);
  });

  it('rotates the bit that falls off back in', () => {
    expect(solve(shift(0b1000_0001, 'left', 'rotate', 1)).result).toBe(0b0000_0011);
    expect(solve(shift(0b0000_0001, 'right', 'rotate', 1)).result).toBe(0b1000_0000);
  });

  it('rotates through the carry as a ninth bit', () => {
    const request = shift(0b1000_0000, 'left', 'carry', 1, 1);
    expect(solve(request).result).toBe(0b0000_0001);
    expect(taps(request, ['carry'])).toEqual({ carry: 1 });
  });

  it('says when a shift changed the sign bit', () => {
    expect(taps(shift(0b0100_0000, 'left', 'zero', 1), ['signChanged'])).toEqual({
      signChanged: 1
    });
  });

  it('leaves the value and the carry alone with no stages', () => {
    const request = shift(0xa5, 'left', 'zero', 0, 1);
    expect(solve(request).result).toBe(0xa5);
    expect(taps(request, ['carry'])).toEqual({ carry: 1 });
  });

  it('shifts by any count in a barrel shifter’s five stages', () => {
    for (let count = 0; count < 32; count++) {
      const stages = barrelStages(count, 32);
      expect(stages).toHaveLength(5);
      const base = { kind: 'shift', width: 32, value: 0x80000001, carryIn: 0, stages } as const;
      expect(solve({ ...base, direction: 'left', fill: 'zero' }).result).toBe(
        (0x80000001 << count) >>> 0
      );
      expect(solve({ ...base, direction: 'right', fill: 'zero' }).result).toBe(
        0x80000001 >>> count
      );
      expect(solve({ ...base, direction: 'right', fill: 'sign' }).result).toBe(
        (0x80000001 >> count) >>> 0
      );
    }
  });
});

describe('solve: a broken gate', () => {
  const request: AluRequest = { kind: 'add', width: 8, a: 0x0f, b: 0x01, carryIn: 0 };

  it('gives the result and the flags the broken circuit makes', () => {
    // The carry out of bit 3 is what turns 0x0F + 1 into 0x10.
    const broken = solve(request, { [ADDER.carry(4)]: 0 });
    expect(solve(request).result).toBe(0x10);
    expect(broken.result).toBe(0x00);
    expect(tapValue(broken, 'zero')).toBe(1);
    expect(tapValue(broken, 'halfCarry')).toBe(0);
  });

  it('breaks the one gate of a bit in AND, OR and XOR', () => {
    const and: AluRequest = { kind: 'and', width: 8, a: 0xf0, b: 0x3c };
    expect(solve(and, { [ADDER.sum(0)]: 1 }).result).toBe(0x31);
  });

  it('breaks a switch of a shifter', () => {
    const shift: AluRequest = {
      kind: 'shift',
      width: 8,
      value: 0b0000_0001,
      direction: 'left',
      fill: 'zero',
      carryIn: 0,
      stages: repeatedStages(1)
    };
    expect(solve(shift, { [SHIFTER.value(1, 7)]: 1 }).result).toBe(0b1000_0010);
  });
});
