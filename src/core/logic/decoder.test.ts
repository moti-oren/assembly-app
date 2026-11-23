import { describe, expect, it } from 'vitest';
import { activeLines, activeTerms, DECODER, decoder, solveDecoder } from './decoder';
import type { DecoderShape } from './decoder';
import type { Bit } from './gates';

/** A 2-to-4 decoder with two lines: `low` for 00 and 01, `ends` for 00 and 11. */
const SHAPE: DecoderShape = {
  inputs: ['a', 'b'],
  terms: [
    { id: 'zero', match: { a: 0, b: 0 } },
    { id: 'one', match: { a: 0, b: 1 } },
    { id: 'three', match: { a: 1, b: 1 } }
  ],
  lines: [
    { id: 'low', terms: ['zero', 'one'] },
    { id: 'ends', terms: ['zero', 'three'] }
  ]
};

const run = (a: Bit, b: Bit) => solveDecoder(SHAPE, { a, b });

describe('decoder', () => {
  it('turns on the one term whose pattern the inputs carry', () => {
    expect(activeTerms(run(0, 0))).toEqual(['zero']);
    expect(activeTerms(run(0, 1))).toEqual(['one']);
    expect(activeTerms(run(1, 1))).toEqual(['three']);
  });

  it('turns on every line a term feeds', () => {
    expect(activeLines(run(0, 0))).toEqual(['low', 'ends']);
    expect(activeLines(run(0, 1))).toEqual(['low']);
    expect(activeLines(run(1, 1))).toEqual(['ends']);
  });

  it('says when no term knows the pattern', () => {
    const unknown = run(1, 0);
    expect(activeTerms(unknown)).toEqual([]);
    expect(activeLines(unknown)).toEqual([]);
    expect(unknown.signals[DECODER.none]).toBe(1);
    expect(run(0, 0).signals[DECODER.none]).toBe(0);
  });

  it('inverts only the inputs a term wants low', () => {
    const circuit = decoder({
      inputs: ['a', 'b'],
      terms: [{ id: 'both', match: { a: 1, b: 1 } }],
      lines: []
    });
    expect(circuit.gates.filter((gate) => gate.kind === 'not').map((gate) => gate.id)).toEqual([
      DECODER.none
    ]);
  });

  it('lets a term leave an input out', () => {
    const shape: DecoderShape = {
      inputs: ['a', 'b'],
      terms: [{ id: 'high', match: { a: 1 } }],
      lines: [{ id: 'out', terms: ['high'] }]
    };
    expect(activeLines(solveDecoder(shape, { a: 1, b: 0 }))).toEqual(['out']);
    expect(activeLines(solveDecoder(shape, { a: 1, b: 1 }))).toEqual(['out']);
    expect(activeLines(solveDecoder(shape, { a: 0, b: 1 }))).toEqual([]);
  });
});
