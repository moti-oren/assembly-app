import type { DecoderSolution } from '@/core/logic/decoder';
import type { Bit } from '@/core/logic/gates';

/** One input column of a decoder's grid, with the bit it carries. */
export interface PlaneInput {
  id: string;
  value: Bit;
}

/** What a term asks of one input: a bit, or nothing. */
export interface PlaneAsk {
  wants: Bit | null;
  /** Whether the input carries what the term asks; true where it asks nothing. */
  met: boolean;
}

/** One AND gate as a row of the grid. */
export interface PlaneRow {
  id: string;
  on: boolean;
  asks: PlaneAsk[];
  /** For every line, whether this term feeds it. */
  feeds: boolean[];
}

export interface PlaneLine {
  id: string;
  value: Bit;
}

/** A decoder as a grid: its AND gates down the side, its inputs and its lines across. */
export interface PlaneView {
  inputs: PlaneInput[];
  rows: PlaneRow[];
  lines: PlaneLine[];
}

/** Lays a solved decoder out as a grid. */
export function planeView({ shape, signals }: DecoderSolution): PlaneView {
  return {
    inputs: shape.inputs.map((id) => ({ id, value: signals[id] })),
    rows: shape.terms.map(({ id, match }) => ({
      id,
      on: signals[id] === 1,
      asks: shape.inputs.map((input) => {
        const wants = input in match ? match[input] : null;
        return { wants, met: wants === null || wants === signals[input] };
      }),
      feeds: shape.lines.map((line) => line.terms.includes(id))
    })),
    lines: shape.lines.map(({ id }) => ({ id, value: signals[id] }))
  };
}
