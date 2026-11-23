import { describe, expect, it } from 'vitest';
import { solveDecoder, type DecoderShape } from '@/core/logic/decoder';
import { planeView } from './controlPlane';

const SHAPE: DecoderShape = {
  inputs: ['a', 'b'],
  terms: [
    { id: 'both', match: { a: 1, b: 1 } },
    { id: 'low', match: { a: 0 } }
  ],
  lines: [
    { id: 'x', terms: ['both'] },
    { id: 'y', terms: ['both', 'low'] }
  ]
};

describe('planeView', () => {
  const view = planeView(solveDecoder(SHAPE, { a: 0, b: 1 }));

  it('gives every input its bit', () => {
    expect(view.inputs).toEqual([
      { id: 'a', value: 0 },
      { id: 'b', value: 1 }
    ]);
  });

  it('says what each term asks, and whether the inputs carry it', () => {
    expect(view.rows[0]).toMatchObject({
      id: 'both',
      on: false,
      asks: [
        { wants: 1, met: false },
        { wants: 1, met: true }
      ]
    });
    expect(view.rows[1]).toMatchObject({
      id: 'low',
      on: true,
      asks: [
        { wants: 0, met: true },
        { wants: null, met: true }
      ]
    });
  });

  it('marks the lines each term feeds, and gives each line its value', () => {
    expect(view.rows.map((row) => row.feeds)).toEqual([
      [true, true],
      [false, true]
    ]);
    expect(view.lines).toEqual([
      { id: 'x', value: 0 },
      { id: 'y', value: 1 }
    ]);
  });
});
