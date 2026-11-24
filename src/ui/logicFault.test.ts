import { describe, expect, it } from 'vitest';
import { ADDER } from '@/core/logic/adder';
import { solve, type AluRequest } from '@/core/logic/alu';
import { repeatedStages } from '@/core/logic/shifter';
import {
  brokenBits,
  faultSummary,
  gateFaultNote,
  withFault,
  withoutFault,
  wrongBits
} from './logicFault';
import { sliceDiagram } from './logicSlice';

const request: AluRequest = { kind: 'add', width: 8, a: 0x0f, b: 0x01, carryIn: 0 };
const healthy = solve(request);
/** The carry out of bit 3, which 0x0F + 1 depends on. */
const carry = ADDER.carry(4);

describe('withFault and withoutFault', () => {
  it('add a fault, change it, and take it away', () => {
    const one = withFault({}, 's0', 1);
    expect(one).toEqual({ s0: 1 });
    expect(withFault(one, 's0', 0)).toEqual({ s0: 0 });
    expect(withoutFault(withFault(one, 'c1', 0), 's0')).toEqual({ c1: 0 });
    expect(withoutFault(one, 'c1')).toEqual(one);
  });
});

describe('wrongBits', () => {
  it('marks the bits the broken circuit gets wrong', () => {
    const wrong = wrongBits(healthy, solve(request, { [carry]: 0 }));
    expect(wrong).toEqual([false, false, false, false, true, false, false, false]);
  });

  it('marks none when the inputs hide the fault', () => {
    expect(wrongBits(healthy, solve(request, { [carry]: 1 })).some(Boolean)).toBe(false);
  });
});

describe('brokenBits', () => {
  it('marks the bit whose gates hold the fault', () => {
    const faults = { [carry]: 0 } as const;
    const broken = brokenBits(faults, solve(request, faults));
    expect(broken.indexOf(true)).toBe(3);
    expect(broken.filter(Boolean)).toHaveLength(1);
  });

  it('marks nothing in a shifter', () => {
    const shift: AluRequest = {
      kind: 'shift',
      width: 8,
      value: 1,
      direction: 'left',
      fill: 'zero',
      carryIn: 0,
      stages: repeatedStages(1)
    };
    expect(brokenBits({}, solve(shift)).some(Boolean)).toBe(false);
  });
});

describe('faultSummary', () => {
  it('sets the wrong answer beside the right one', () => {
    const summary = faultSummary(healthy, solve(request, { [carry]: 0 }), 1);
    expect(summary.broken).toBe('One gate is broken.');
    expect(summary.effect).toBe(
      'The circuit answers 0x00; working, it would answer 0x10. One bit is wrong.'
    );
  });

  it('says when the inputs hide the fault', () => {
    const summary = faultSummary(healthy, solve(request, { [carry]: 1 }), 1);
    expect(summary.effect).toContain('These inputs hide it');
  });

  it('says when only a flag is wrong', () => {
    // The overflow gate feeds no bit of the result.
    const summary = faultSummary(healthy, solve(request, { overflow: 1 }), 1);
    expect(summary.effect).toBe(
      'The result is still right, but a wire a flag is read from is not.'
    );
  });

  it('counts the gates and the bits', () => {
    const faults = { [ADDER.sum(0)]: 1, [ADDER.sum(1)]: 1 } as const;
    const summary = faultSummary(healthy, solve(request, faults), 2);
    expect(summary.broken).toBe('2 gates are broken.');
    expect(summary.effect).toContain('2 bits are wrong.');
  });
});

describe('gateFaultNote', () => {
  const gate = sliceDiagram(healthy, 3, 0)!.gates.find((each) => each.id === carry)!;

  it('says nothing of a working gate', () => {
    expect(gateFaultNote(gate, null, healthy.signals)).toBe('');
  });

  it('says what the gate would put out if it worked', () => {
    expect(gateFaultNote(gate, 0, healthy.signals)).toBe(
      'Stuck at 0: the output ignores the inputs. Working, it would put out 1.'
    );
  });

  it('says when the inputs hide the fault', () => {
    expect(gateFaultNote(gate, 1, healthy.signals)).toContain('these inputs hide the fault');
  });
});
