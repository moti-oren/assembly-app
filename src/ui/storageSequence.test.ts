import { describe, expect, it } from 'vitest';
import { settle } from '@/core/logic/feedback';
import type { Bit, Signals } from '@/core/logic/gates';
import { holding } from '@/core/logic/register';
import { SEQUENCE } from '@/core/logic/sequence';
import {
  SEQUENCE_CIRCUITS,
  SEQUENCE_HINT,
  SEQUENCE_INPUT,
  SEQUENCE_WIDTH,
  sequenceChart,
  sequencePress,
  sequenceRows,
  sequenceTold,
  sequenceValue,
  tickText,
  valueText,
  type SequenceId
} from './storageSequence';
import type { Sample } from './storageTiming';

/** A circuit worked by hand, keeping its trace as the page does. */
function bench(kind: SequenceId) {
  const input = SEQUENCE_INPUT[kind].signal;
  let inputs: Record<string, Bit> = { [SEQUENCE.clock]: 0, [input]: 0 };
  let signals: Signals = holding(SEQUENCE_WIDTH, 0);
  const trace: Sample[] = [];
  const apply = (change: Record<string, Bit>) => {
    inputs = { ...inputs, ...change };
    const state = settle(SEQUENCE_CIRCUITS[kind], inputs, signals);
    signals = state.signals;
    trace.push(state);
  };
  apply({});
  return {
    trace,
    signals: () => signals,
    set: (value: Bit) => apply({ [input]: value }),
    tick() {
      apply({ [SEQUENCE.clock]: 1 });
      apply({ [SEQUENCE.clock]: 0 });
    }
  };
}

describe('sequenceRows', () => {
  it('shows a shift register taking in the bit below each flip-flop', () => {
    const cells = bench('shift');
    cells.set(1);
    cells.tick();
    const [next, holds] = sequenceRows('shift', cells.signals());
    expect(holds).toMatchObject({ label: 'Holds', bits: [1, 0, 0, 0], tone: 'plain' });
    expect(next).toMatchObject({ label: 'Next', bits: [1, 1, 0, 0], tone: 'quiet' });
  });

  it('shows which bits of a counter will flip, and the value plus one waiting', () => {
    const cells = bench('counter');
    cells.set(1);
    for (let i = 0; i < 3; i++) cells.tick();
    const [flips, next, holds] = sequenceRows('counter', cells.signals());
    expect(holds.bits).toEqual([1, 1, 0, 0]);
    expect(flips).toMatchObject({ label: 'Flips', bits: [1, 1, 1, 0] });
    expect(next.bits).toEqual([0, 0, 1, 0]);
  });
});

describe('the value', () => {
  it('is read in binary and as a number', () => {
    const cells = bench('counter');
    cells.set(1);
    for (let i = 0; i < 5; i++) cells.tick();
    expect(sequenceValue(cells.signals())).toBe(5);
    expect(valueText(cells.signals())).toBe('0101 = 5');
  });
});

describe('sequenceChart', () => {
  it('follows the input, the clock and every flip-flop, and marks each rise', () => {
    const cells = bench('shift');
    cells.tick();
    cells.tick();
    const chart = sequenceChart('shift', cells.trace);
    expect(chart.rows.map((row) => row.label)).toEqual(['In', 'Clock', 'Q3', 'Q2', 'Q1', 'Q0']);
    expect(chart.edges).toHaveLength(2);
  });
});

describe('tickText', () => {
  it('starts with a hint', () => {
    const { trace } = bench('counter');
    expect(tickText('counter', null, trace[0])).toBe(SEQUENCE_HINT);
    expect(sequencePress('counter', trace, 1, 0)).toBe(SEQUENCE_HINT);
  });

  it('tells a count, a wrap and a tick that counts nothing', () => {
    const cells = bench('counter');
    cells.set(1);
    cells.tick();
    expect(sequencePress('counter', cells.trace, 2, 1)).toBe(
      'Tick 1. The clock rose: 0000 became 0001, 0 + 1 = 1.'
    );
    for (let i = 0; i < 15; i++) cells.tick();
    expect(sequencePress('counter', cells.trace, 2, 16)).toContain('wrapped around');
    cells.set(0);
    expect(sequencePress('counter', cells.trace, 1, 16)).toContain('Count is now 0');
    cells.tick();
    expect(sequencePress('counter', cells.trace, 2, 17)).toBe(
      'Tick 17. The clock rose, but Count is 0: it stays 0000.'
    );
    cells.tick();
    expect(sequencePress('counter', cells.trace, 2, 18)).toContain('Tick 18.');
  });

  it('tells a shift, and every step for a reader who cannot see the waves', () => {
    const cells = bench('shift');
    cells.set(1);
    cells.tick();
    expect(sequenceTold('shift', cells.trace)).toEqual([
      'In is now 1: it waits at bit 0 for the clock to rise.',
      'The clock rose: every bit moved one place up, and In (1) came in at bit 0. 0000 became 0001.',
      'The clock fell: nothing moves until it rises again.'
    ]);
  });
});
