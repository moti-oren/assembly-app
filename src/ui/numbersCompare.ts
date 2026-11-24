import type { ArithmeticSolution } from '@/core/representation/arithmetic';
import {
  compare,
  holds,
  type ScaleComparison,
  type Order,
  type Relation
} from '@/core/representation/comparison';
import type { NumberView } from '@/core/numberLink';
import type { ConditionSet, DifferenceFlags } from './numbersConditions';
import { numberText } from './numbersView';

/**
 * Whether the view is two numbers compared: a difference with nothing more taken off, which set
 * every flag a jump reads.
 */
export function isComparison({ request, comparable }: NumberView): boolean {
  return comparable && request.kind === 'subtract' && request.extra === 0;
}

/** What the difference leaves to decide by, read from the numbers and not from a CPU. */
export function differenceFlags(solution: ArithmeticSolution): DifferenceFlags {
  return {
    borrow: !solution.unsigned.fits,
    overflow: !solution.signed.fits,
    zero: solution.result === 0,
    negative: solution.signed.shown < 0
  };
}

const SIGNS: Record<Relation, string> = {
  equal: '=',
  notEqual: '≠',
  less: '<',
  lessOrEqual: '≤',
  greater: '>',
  greaterOrEqual: '≥'
};

/** One jump, the question it stands for and what becomes of it for the two numbers. */
export interface CompareRow {
  mnemonic: string;
  /** `A > B, unsigned` */
  asks: string;
  /** The question with the numbers in it: `255 > 1`. */
  numbers: string;
  /** Whether the numbers answer the question with a yes. */
  truth: boolean;
  /** What the CPU goes by. */
  when: string;
  taken: boolean;
  /** What the CPU does then, in a word or two. */
  outcome: string;
  /** True when the jump goes the other way than the numbers say. */
  wrong: boolean;
  caveat: string | null;
}

/** Every jump of the set, for the two numbers of a difference. */
export function compareRows(set: ConditionSet, solution: ArithmeticSolution): CompareRow[] {
  const { a, b, width } = solution.request;
  const compared = compare(a, b, width);
  const flags = differenceFlags(solution);
  return set.conditions.map((condition) => {
    const sign = SIGNS[condition.relation];
    const read = compared[condition.scale ?? 'unsigned'];
    const truth = holds(read.order, condition.relation);
    const taken = condition.taken(flags);
    return {
      mnemonic: condition.mnemonic,
      asks: condition.scale ? `A ${sign} B, ${condition.scale}` : `A ${sign} B`,
      numbers: `${numberText(read.a)} ${sign} ${numberText(read.b)}`,
      truth,
      when: condition.when,
      taken,
      outcome: taken ? set.verb : 'goes on',
      wrong: taken !== truth,
      caveat: condition.caveat ?? null
    };
  });
}

const ORDERS: Record<Order, string> = {
  less: 'is less than',
  equal: 'equals',
  greater: 'is greater than'
};

/** Whether the two scales put the numbers in the same order, and that in words. */
export interface CompareSummary {
  /** True when one scale says A is the smaller and the other says B is. */
  split: boolean;
  text: string;
}

const sentence = ({ a, b, order }: ScaleComparison): string =>
  `${numberText(a)} ${ORDERS[order]} ${numberText(b)}`;

export function compareSummary(solution: ArithmeticSolution): CompareSummary {
  const { a, b, width } = solution.request;
  const { unsigned, signed } = compare(a, b, width);
  if (unsigned.order !== signed.order) {
    return {
      split: true,
      text: `The scales disagree: unsigned, ${sentence(unsigned)}; signed, ${sentence(signed)}. The bits cannot say which is meant: the program does, by the jump it uses.`
    };
  }
  if (unsigned.order === 'equal') {
    return { split: false, text: 'The bits are the same, so A equals B on both scales.' };
  }
  return {
    split: false,
    text: `Both scales agree: A ${ORDERS[unsigned.order]} B. Flip the top bit of one of them to set the scales apart.`
  };
}

/** What the jumps that do not always answer their question need said about them. */
export interface CompareWarning {
  /** True when one of them goes against the numbers right now. */
  wrong: boolean;
  text: string;
}

export function compareWarning(rows: readonly CompareRow[]): CompareWarning | null {
  const text = rows.find((row) => row.caveat !== null)?.caveat;
  if (!text) return null;
  return { wrong: rows.some((row) => row.caveat !== null && row.wrong), text };
}
