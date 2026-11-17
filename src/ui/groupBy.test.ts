import { describe, expect, it } from 'vitest';
import { groupBy } from './groupBy';

describe('groupBy', () => {
  it('keeps the groups and their items in first-seen order', () => {
    const words = ['apple', 'bean', 'avocado', 'beet', 'cherry'];
    expect(groupBy(words, (word) => word[0])).toEqual([
      ['a', ['apple', 'avocado']],
      ['b', ['bean', 'beet']],
      ['c', ['cherry']]
    ]);
  });
});
