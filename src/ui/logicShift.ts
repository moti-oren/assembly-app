import type { AluSolution, ShiftRequest } from '@/core/logic/alu';
import { bitOf, type Bit } from '@/core/logic/gates';
import { SHIFTER } from '@/core/logic/shifter';
import { COLUMN_UNITS, rowUnits } from './logicLayout';

/** One row of the shifter as it is drawn: the bits going in, where each bit of its output comes from. */
export interface StageView {
  index: number;
  distance: number;
  on: Bit;
  /** The value after this row, bit 0 first. */
  after: Bit[];
  /** The carry flag after this row. */
  carryAfter: Bit;
  /**
   * Where each output bit comes from: a bit of the row's input, or `edge` for a bit brought in
   * at the end the others move away from.
   */
  sources: (number | 'edge')[];
  /** The bit brought in at the edge: a 0, or the carry. */
  edge: Bit;
}

function sourceOf(request: ShiftRequest, distance: number, bit: number): number | 'edge' {
  const { width, direction, fill } = request;
  const from = direction === 'left' ? bit - distance : bit + distance;
  if (from >= 0 && from < width) return from;
  if (fill === 'sign') return width - 1;
  if (fill === 'rotate') return ((from % width) + width) % width;
  return 'edge';
}

/** The rows of a solved shift, top to bottom. */
export function stageViews(solution: AluSolution): StageView[] {
  const { request, signals } = solution;
  if (request.kind !== 'shift') return [];
  const bits = Array.from({ length: request.width }, (_, bit) => bit);
  return request.stages.map((stage, index) => ({
    index,
    distance: stage.distance,
    on: stage.on,
    after: bits.map((bit) => signals[SHIFTER.value(index + 1, bit)]),
    carryAfter: signals[SHIFTER.carry(index + 1)],
    sources: bits.map((bit) => (stage.on ? sourceOf(request, stage.distance, bit) : bit)),
    edge: request.fill === 'carry' ? signals[SHIFTER.carry(index)] : 0
  }));
}

/** A solved shift as it is drawn: its rows, and what comes in and goes out at the ends. */
export interface ShifterView {
  width: number;
  /** Whether the bits move towards the top bit, which is on the left. */
  left: boolean;
  /** A barrel shifter's rows are switched by the count; a CPU that repeats has no switch. */
  switched: boolean;
  /** The value going in, bit 0 first. */
  input: Bit[];
  /** The carry going in, for a rotate through carry; null for the other shifts. */
  carryIn: Bit | null;
  /**
   * Where a bit brought in at the edge starts, in the units of logicLayout. A 0 comes in just
   * past the end the others move away from; the carry comes round from its own column, at the
   * end they move towards.
   */
  edgeX: number;
  stages: StageView[];
  /** The rows to draw, with null where the middle of a long shift is left out. */
  shown: (number | null)[];
}

export function shifterView(solution: AluSolution): ShifterView | null {
  const { request } = solution;
  if (request.kind !== 'shift') return null;
  const { width } = request;
  const left = request.direction === 'left';
  const throughCarry = request.fill === 'carry';
  const far = rowUnits(width);
  const edgeX = throughCarry
    ? left
      ? -COLUMN_UNITS / 2
      : far + COLUMN_UNITS / 2
    : left
      ? far + 1.5
      : -1.5;
  const stages = stageViews(solution);
  return {
    width,
    left,
    switched: request.stages.some((stage) => stage.distance !== 1),
    input: Array.from({ length: width }, (_, bit) => bitOf(request.value, bit)),
    carryIn: throughCarry ? request.carryIn : null,
    edgeX,
    stages,
    shown: shownStages(stages.length)
  };
}

/**
 * Which rows to draw when a CPU that shifts a place at a time made many: the first few and the
 * last, with null where the rows between them are left out.
 */
export function shownStages(count: number, limit = 6): (number | null)[] {
  const all = Array.from({ length: count }, (_, index) => index);
  if (count <= limit) return all;
  return [...all.slice(0, limit - 2), null, count - 1];
}
