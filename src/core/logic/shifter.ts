import type { Bit, Circuit, Gate } from './gates';

export type ShiftDirection = 'left' | 'right';

/**
 * What comes in at the end the bits move away from: a 0, a copy of the sign bit (arithmetic right
 * shift), the bit that fell off the other end (rotate), or the carry flag (rotate through carry).
 */
export type ShiftFill = 'zero' | 'sign' | 'rotate' | 'carry';

/** One row of muxes: moves every bit `distance` places when `on` is 1, else passes them through. */
export interface ShiftStage {
  distance: number;
  on: Bit;
}

export interface ShifterShape {
  width: number;
  direction: ShiftDirection;
  fill: ShiftFill;
  /** How far each stage moves the bits. */
  distances: readonly number[];
}

/**
 * The names of a shifter's wires: `value(stage, bit)` goes into that stage, so stage 0 holds the
 * input and the stage after the last holds the result. `carry(stage)` is the carry flag there.
 */
export const SHIFTER = {
  value: (stage: number, bit: number) => `v${stage}_${bit}`,
  carry: (stage: number) => `k${stage}`,
  on: (stage: number) => `on${stage}`,
  /** A wire tied to 0, for the bits a plain shift brings in. */
  zero: 'zero'
};

/** Where bit `bit` of a stage's output comes from when the stage shifts. */
export function shiftSource(shape: ShifterShape, stage: number, bit: number): string {
  const { width, direction, fill } = shape;
  const distance = shape.distances[stage];
  const from = direction === 'left' ? bit - distance : bit + distance;
  if (from >= 0 && from < width) return SHIFTER.value(stage, from);
  switch (fill) {
    case 'zero':
      return SHIFTER.zero;
    case 'sign':
      return SHIFTER.value(stage, width - 1);
    case 'rotate':
      return SHIFTER.value(stage, ((from % width) + width) % width);
    case 'carry':
      return SHIFTER.carry(stage);
  }
}

/** The last bit a stage pushes out, which a shift by one puts in the carry flag. */
function pushedOut(shape: ShifterShape, stage: number): string {
  const distance = shape.distances[stage];
  // A stage that moves further than the width has pushed everything out, and zeros after it.
  if (distance > shape.width) return SHIFTER.zero;
  const bit = shape.direction === 'left' ? shape.width - distance : distance - 1;
  return SHIFTER.value(stage, bit);
}

function stageGates(shape: ShifterShape, stage: number): Gate[] {
  const on = SHIFTER.on(stage);
  const bits = Array.from({ length: shape.width }, (_, bit): Gate => {
    const kept = SHIFTER.value(stage, bit);
    return {
      id: SHIFTER.value(stage + 1, bit),
      kind: 'mux',
      inputs: [on, kept, shiftSource(shape, stage, bit)]
    };
  });
  const carry: Gate = {
    id: SHIFTER.carry(stage + 1),
    kind: 'mux',
    inputs: [on, SHIFTER.carry(stage), pushedOut(shape, stage)]
  };
  return [...bits, carry];
}

/**
 * A shifter built from rows of muxes. Rows of distance 1, 2, 4… switched by the bits of the count
 * make a barrel shifter; rows of distance 1, one per count, are a CPU that shifts a bit at a time.
 */
export function shifter(shape: ShifterShape): Circuit {
  const stages = shape.distances.map((_, stage) => stage);
  const bits = Array.from({ length: shape.width }, (_, bit) => bit);
  return {
    inputs: [
      ...bits.map((bit) => SHIFTER.value(0, bit)),
      SHIFTER.carry(0),
      SHIFTER.zero,
      ...stages.map(SHIFTER.on)
    ],
    gates: stages.flatMap((stage) => stageGates(shape, stage))
  };
}

/** The stages of a barrel shifter for `count`: one per bit of the count, the lowest first. */
export function barrelStages(count: number, width: number): ShiftStage[] {
  const stages: ShiftStage[] = [];
  for (let distance = 1, bit = 0; distance < width; distance *= 2, bit++) {
    stages.push({ distance, on: ((count >> bit) & 1) as Bit });
  }
  return stages;
}

/** The stages of a CPU that shifts one place at a time, `count` times. */
export function repeatedStages(count: number): ShiftStage[] {
  return Array.from({ length: count }, () => ({ distance: 1, on: 1 }));
}
