import { describe, expect, it } from 'vitest';
import { describeBranch, list } from './explainText';

describe('list', () => {
  it('joins the last item with "and"', () => {
    expect(list([])).toBe('');
    expect(list(['A'])).toBe('A');
    expect(list(['A', 'B'])).toBe('A and B');
    expect(list(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('describeBranch', () => {
  const jump = { name: 'JGE', verb: 'jumps', when: 'SF = OF' } as const;

  it('says a taken jump met its condition', () => {
    expect(describeBranch({ ...jump, values: ['SF is 1', 'OF is 1'], taken: true })).toBe(
      'Taken: JGE jumps when SF = OF, and SF is 1 and OF is 1.'
    );
  });

  it('says what stopped a jump that was not taken', () => {
    expect(describeBranch({ ...jump, values: ['SF is 1', 'OF is 0'], taken: false })).toBe(
      'Not taken: JGE jumps when SF = OF, but SF is 1 and OF is 0.'
    );
  });
});
