import type { ArithmeticSolution } from './representation/arithmetic';
import type { Scale } from './representation/readings';
import type { NumberRequest, NumberSolution } from './representation/request';

/**
 * What a flag says about the numbers: on one scale, that the true answer did not fit (`outside`)
 * or is below zero (`below`); or, of the result itself, that it is zero or reads as negative.
 */
export type Verdict = 'outside' | 'below' | 'zero' | 'negative';

/** One of a CPU's flags, and the question about the numbers that it answers. */
export interface FlagReading {
  /** The CPU's own name for it: a flag, or what a comparison decides. */
  flag: string;
  /** The scale the question is asked on: `decimal` is the two digits of a packed decimal byte. */
  scale: Scale | 'decimal';
  verdict: Verdict;
  /** The flag is 1 when the answer is no. */
  inverted: boolean;
}

/** One executed instruction as arithmetic on numbers: what went in, and what each flag means. */
export interface NumberView {
  request: NumberRequest;
  flags: FlagReading[];
  /** False when the result is thrown away and only the flags are kept, as in a comparison. */
  resultKept: boolean;
  note: string | null;
}

/** An instruction with nothing to show as numbers, and why. */
export interface NoNumberView {
  unavailable: string;
}

/** Where an executed instruction leads in the number topic. */
export type NumberLink = NumberView | NoNumberView;

export function hasNumbers(link: NumberLink): link is NumberView {
  return 'request' in link;
}

export function reads(
  flag: string,
  scale: FlagReading['scale'],
  verdict: Verdict,
  inverted = false
): FlagReading {
  return { flag, scale, verdict, inverted };
}

function arithmeticVerdict(solution: ArithmeticSolution, scale: Scale, verdict: Verdict): boolean {
  switch (verdict) {
    case 'outside':
      return !solution[scale].fits;
    case 'below':
      return solution[scale].exact < 0;
    case 'zero':
      return solution.result === 0;
    case 'negative':
      return solution.signed.shown < 0;
  }
}

function answer(solution: NumberSolution, { flag, scale, verdict }: FlagReading): boolean {
  if ('digits' in solution && scale === 'decimal' && verdict === 'outside') {
    return solution.out === 1;
  }
  if ('unsigned' in solution && scale !== 'decimal') {
    return arithmeticVerdict(solution, scale, verdict);
  }
  throw new Error(`Nothing here says whether ${flag} is ${verdict} on the ${scale} scale.`);
}

/** The value the solved numbers give each flag of the view. */
export function flagAnswers(view: NumberView, solution: NumberSolution): Record<string, 0 | 1> {
  const values: Record<string, 0 | 1> = {};
  for (const reading of view.flags) {
    values[reading.flag] = answer(solution, reading) !== reading.inverted ? 1 : 0;
  }
  return values;
}
