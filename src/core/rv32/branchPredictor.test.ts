import { describe, expect, it } from 'vitest';
import { branchPredictor, type PredictorKind } from './branchPredictor';

/** The guesses a predictor makes for one branch that does `outcomes`, in order. */
function guesses(kind: PredictorKind, outcomes: boolean[]): boolean[] {
  const predictor = branchPredictor(kind);
  return outcomes.map((taken) => {
    const guess = predictor.guess(0x40);
    predictor.learn(0x40, taken);
    return guess;
  });
}

const T = true;
const N = false;

describe('branchPredictor', () => {
  it('makes the same guess every time when it is static', () => {
    expect(guesses('not-taken', [T, T, N])).toEqual([N, N, N]);
    expect(guesses('taken', [T, T, N])).toEqual([T, T, T]);
  });

  it('with one bit, guesses what the branch did last', () => {
    expect(guesses('one-bit', [T, T, N, T])).toEqual([N, T, T, N]);
  });

  it('with two bits, keeps a guess it is sure of through one miss', () => {
    // A loop taken three times, left, and entered again: one miss at the exit, none on the way in.
    expect(guesses('two-bit', [T, T, T, N, T, T])).toEqual([N, T, T, T, T, T]);
    expect(guesses('two-bit', [T, T, N, N, N])).toEqual([N, T, T, T, N]);
  });

  it('keeps a state for each branch', () => {
    const predictor = branchPredictor('one-bit');
    predictor.learn(0x40, true);
    expect(predictor.guess(0x40)).toBe(true);
    expect(predictor.guess(0x44)).toBe(false);
  });
});
