import { describe, expect, it } from 'vitest';
import { settle } from '@/core/logic/feedback';
import { dLatch, flipFlop, holdingBit, srLatch } from '@/core/logic/flipFlop';
import type { Bit, Circuit } from '@/core/logic/gates';
import {
  pressText,
  recorded,
  traceTexts,
  stepText,
  TIMING_HINT,
  timingChart,
  TRACE_LENGTH,
  type Sample
} from './storageTiming';

/** A cell worked by hand: it starts at rest, and each flip of an input adds a sample. */
function worked(circuit: Circuit) {
  let inputs: Record<string, Bit> = Object.fromEntries(circuit.inputs.map((name) => [name, 0]));
  let trace: Sample[] = [settle(circuit, inputs, holdingBit(0))];
  const set = (next: Record<string, Bit>): Sample => {
    inputs = next;
    const sample = settle(circuit, inputs, trace[trace.length - 1].signals);
    trace = recorded(trace, sample);
    return sample;
  };
  return {
    flip: (signal: string) => set({ ...inputs, [signal]: (inputs[signal] ^ 1) as Bit }),
    release: () => set(Object.fromEntries(circuit.inputs.map((name) => [name, 0]))),
    trace: () => trace,
    last: (back = 1) => trace[trace.length - back]
  };
}

describe('recorded', () => {
  it('keeps the newest samples once the trace is full', () => {
    const cell = worked(dLatch());
    for (let press = 0; press < TRACE_LENGTH + 5; press++) cell.flip('d');
    expect(cell.trace()).toHaveLength(TRACE_LENGTH);
    expect(cell.last().signals.d).toBe(1);
  });
});

describe('timingChart', () => {
  it('draws a row per wire and a flat line for a cell at rest', () => {
    const chart = timingChart('sr', worked(srLatch()).trace());
    expect(chart.rows.map((row) => row.label)).toEqual(['S', 'R', 'Q', 'Q̅']);
    expect(chart.rows[0].path).toBe('M46 22H66');
    expect(chart.rows[3].value).toBe('1');
    expect(chart.height).toBe(4 * 28);
  });

  it('steps a wave up where its wire rose', () => {
    const cell = worked(srLatch());
    cell.flip('s');
    const [s, , q] = timingChart('sr', cell.trace()).rows;
    expect(s.path).toBe('M46 22H66V6H86');
    expect(q.path).toBe('M46 78H66V62H86');
  });

  it('marks the rises of the flip-flop’s clock, and of no other cell', () => {
    const cell = worked(flipFlop());
    cell.flip('clk');
    cell.flip('clk');
    cell.flip('clk');
    expect(timingChart('flipFlop', cell.trace()).edges).toEqual([66, 106]);
    const latch = worked(dLatch());
    latch.flip('e');
    expect(timingChart('d', latch.trace()).edges).toEqual([]);
  });

  it('draws both levels for the outputs of a latch that cannot decide', () => {
    const cell = worked(srLatch());
    cell.flip('s');
    cell.flip('r');
    cell.release();
    expect(cell.last().settled).toBe(false);
    const [s, , q] = timingChart('sr', cell.trace()).rows;
    expect(q.unknown).toBe('M106 62H126M106 78H126');
    expect(q.value).toBe('?');
    expect(s.unknown).toBe('');
    expect(s.value).toBe('0');
  });

  it('starts the wave again after a step it could not draw', () => {
    const cell = worked(srLatch());
    cell.flip('s');
    cell.flip('r');
    cell.release();
    cell.flip('s');
    const q = timingChart('sr', cell.trace()).rows[2];
    expect(q.path.endsWith('M126 62H146')).toBe(true);
  });
});

describe('the trace in words', () => {
  it('tells both halves of a pulse', () => {
    const cell = worked(flipFlop());
    cell.flip('d');
    cell.flip('clk');
    cell.flip('clk');
    expect(pressText('flipFlop', cell.trace(), 2)).toBe(
      'The clock rose: Q took D, and is now 1. The clock fell: Q keeps its 1, and the first latch is open to D again.'
    );
    expect(pressText('flipFlop', cell.trace(), 1)).toContain('The clock fell');
    expect(pressText('flipFlop', cell.trace(), 1)).not.toContain('rose');
  });

  it('asks for a first change, and says nothing without a cell’s trace', () => {
    expect(pressText('d', worked(dLatch()).trace(), 1)).toBe(TIMING_HINT);
    expect(pressText('d', [], 1)).toBe('');
  });

  it('lists every step, the undecided one too', () => {
    const cell = worked(srLatch());
    cell.flip('s');
    cell.flip('r');
    cell.release();
    const told = traceTexts('sr', cell.trace());
    expect(told).toHaveLength(3);
    expect(told[0]).toBe('S went to 1: Q is now 1.');
    expect(told[2]).toContain('could not decide');
  });

  it('puts the values right after the newest step', () => {
    const cell = worked(dLatch());
    cell.flip('d');
    expect(timingChart('d', cell.trace()).valueX).toBe(46 + 2 * 20 + 6);
  });
});

describe('stepText', () => {
  it('asks for a first change', () => {
    const cell = worked(dLatch());
    expect(stepText('d', null, cell.last())).toBe(TIMING_HINT);
  });

  it('says a flip-flop ignores D while the clock is high', () => {
    const cell = worked(flipFlop());
    cell.flip('clk');
    cell.flip('d');
    expect(cell.last().signals.q).toBe(0);
    expect(stepText('flipFlop', cell.last(2), cell.last())).toContain('nothing let it in');
  });

  it('says a flip-flop takes D when the clock rises', () => {
    const cell = worked(flipFlop());
    cell.flip('d');
    expect(stepText('flipFlop', cell.last(2), cell.last())).toContain('the first latch followed');
    cell.flip('clk');
    expect(cell.last().signals.q).toBe(1);
    expect(stepText('flipFlop', cell.last(2), cell.last())).toBe(
      'The clock rose: Q took D, and is now 1.'
    );
    cell.flip('clk');
    expect(stepText('flipFlop', cell.last(2), cell.last())).toContain('Q keeps its 1');
  });

  it('says a D latch follows D only while E is 1', () => {
    const cell = worked(dLatch());
    cell.flip('d');
    expect(stepText('d', cell.last(2), cell.last())).toContain('Q did not move');
    cell.flip('e');
    expect(stepText('d', cell.last(2), cell.last())).toContain('Q took D. It is now 1');
    cell.flip('d');
    expect(stepText('d', cell.last(2), cell.last())).toContain('followed it at once, to 0');
    cell.flip('e');
    expect(stepText('d', cell.last(2), cell.last())).toContain('keeps the 0');
  });

  it('tells an SR latch’s steps, and the state that is no bit', () => {
    const cell = worked(srLatch());
    cell.flip('s');
    expect(stepText('sr', cell.last(2), cell.last())).toBe('S went to 1: Q is now 1.');
    cell.flip('s');
    expect(stepText('sr', cell.last(2), cell.last())).toBe('S went to 0: Q stays 1.');
    cell.flip('s');
    cell.flip('r');
    expect(stepText('sr', cell.last(2), cell.last())).toContain('no bit at all');
  });

  it('leaves a latch that cannot decide to the page’s own notice', () => {
    const cell = worked(srLatch());
    cell.flip('s');
    cell.flip('r');
    cell.release();
    expect(stepText('sr', cell.last(2), cell.last())).toBe('');
  });
});
