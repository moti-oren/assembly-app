import { readAs, type Scale } from './readings';

/** How the first of two numbers stands to the second. */
export type Order = 'less' | 'equal' | 'greater';

/** A question a program asks of two numbers before it jumps. */
export type Relation = 'equal' | 'notEqual' | 'less' | 'lessOrEqual' | 'greater' | 'greaterOrEqual';

/** Two rows of bits as numbers on one scale, and which is the smaller. */
export interface ScaleComparison {
  scale: Scale;
  a: number;
  b: number;
  order: Order;
}

/** Two rows of bits compared twice: the same bits can be in a different order on each scale. */
export interface Comparison {
  unsigned: ScaleComparison;
  signed: ScaleComparison;
}

function onScale(a: number, b: number, width: number, scale: Scale): ScaleComparison {
  const first = readAs(a, width, scale);
  const second = readAs(b, width, scale);
  const order = first < second ? 'less' : first > second ? 'greater' : 'equal';
  return { scale, a: first, b: second, order };
}

/** Compares the two as whole numbers, once on each scale. */
export function compare(a: number, b: number, width: number): Comparison {
  return {
    unsigned: onScale(a, b, width, 'unsigned'),
    signed: onScale(a, b, width, 'signed')
  };
}

/** Whether numbers in that order answer the question with a yes. */
export function holds(order: Order, relation: Relation): boolean {
  switch (relation) {
    case 'equal':
      return order === 'equal';
    case 'notEqual':
      return order !== 'equal';
    case 'less':
      return order === 'less';
    case 'lessOrEqual':
      return order !== 'greater';
    case 'greater':
      return order === 'greater';
    case 'greaterOrEqual':
      return order !== 'less';
  }
}
