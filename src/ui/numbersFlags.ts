import { flagAnswers, type FlagReading, type NumberView } from '@/core/numberLink';
import type { ScaleSolution } from '@/core/representation/arithmetic';
import type { NumberSolution } from '@/core/representation/request';
import { numberText as text } from './numbersView';

/** One flag of the operation: its value, and what that says about the numbers. */
export interface FlagRow {
  flag: string;
  value: 0 | 1;
  scale: FlagReading['scale'];
  /** When the flag is 1, in words. */
  meaning: string;
}

function question({ scale, verdict }: FlagReading): string {
  switch (verdict) {
    case 'outside':
      return `the ${scale} answer does not fit`;
    case 'below':
      return `A is less than B on the ${scale} scale`;
    case 'remainder':
      return 'a 1 was pushed out: the halving left one over';
    case 'zero':
      return 'the result is zero';
    case 'negative':
      return 'the result is negative on the signed scale';
  }
}

/** Every flag the operation sets, in the order the CPU's link lists them. */
export function flagRows(view: NumberView, solution: NumberSolution): FlagRow[] {
  const values = flagAnswers(view, solution);
  return view.flags.map((reading) => ({
    flag: reading.flag,
    value: values[reading.flag],
    scale: reading.scale,
    meaning: `${reading.inverted ? '1 unless' : '1 when'} ${question(reading)}`
  }));
}

/** One scale's reading of an operation, as the sum and what became of it. */
export interface ScaleSummary {
  /** `127 + 1 = 128` */
  sum: string;
  fits: boolean;
  /** Whether the answer fit, and what the bits say when it did not. */
  verdict: string;
}

export function scaleSummary(
  solution: ScaleSolution,
  kind: 'add' | 'subtract',
  extra: 0 | 1
): ScaleSummary {
  const sign = kind === 'add' ? '+' : '−';
  // A negative number after a sign is set in brackets, as it is written by hand.
  const second = solution.b < 0 ? `(${text(solution.b)})` : text(solution.b);
  const carried = extra ? ` ${sign} 1` : '';
  const { min, max } = solution.range;
  const range = `${text(min)} to ${text(max)}`;
  return {
    sum: `${text(solution.a)} ${sign} ${second}${carried} = ${text(solution.exact)}`,
    fits: solution.fits,
    verdict: solution.fits
      ? `fits in ${range}`
      : `outside ${range}: the bits read ${text(solution.shown)}`
  };
}
