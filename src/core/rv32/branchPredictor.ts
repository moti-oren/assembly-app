/**
 * How a pipelined CPU guesses, while it fetches a conditional branch, whether the branch will be
 * taken: it must fetch something behind the branch two cycles before the branch decides in EX.
 */

export const PREDICTORS = ['not-taken', 'taken', 'one-bit', 'two-bit'] as const;

/**
 * - `not-taken`, `taken`: the same guess for every branch.
 * - `one-bit`: what this branch did the last time it ran.
 * - `two-bit`: a counter per branch, which counts up when the branch is taken and down when it is
 *   not. Once it is sure of its guess (at either end), one wrong guess does not change it.
 */
export type PredictorKind = (typeof PREDICTORS)[number];

export interface BranchPredictor {
  /** The guess for the branch at `address`. */
  guess(address: number): boolean;
  /** Told what the branch did, once it has decided. */
  learn(address: number, taken: boolean): void;
}

/** The two-bit counter: 0 and 1 guess "not taken", 2 and 3 "taken". */
const WEAKLY_NOT_TAKEN = 1;
const STRONGLY_TAKEN = 3;

/** A predictor that has seen no branch yet: one it does not know, it guesses "not taken". */
export function branchPredictor(kind: PredictorKind): BranchPredictor {
  if (kind === 'not-taken' || kind === 'taken') {
    return { guess: () => kind === 'taken', learn: () => undefined };
  }
  const counters = new Map<number, number>();
  if (kind === 'one-bit') {
    return {
      guess: (address) => counters.get(address) === 1,
      learn: (address, taken) => void counters.set(address, taken ? 1 : 0)
    };
  }
  return {
    guess: (address) => (counters.get(address) ?? WEAKLY_NOT_TAKEN) > WEAKLY_NOT_TAKEN,
    learn: (address, taken) => {
      const counter = counters.get(address) ?? WEAKLY_NOT_TAKEN;
      const next = taken ? Math.min(counter + 1, STRONGLY_TAKEN) : Math.max(counter - 1, 0);
      counters.set(address, next);
    }
  };
}
