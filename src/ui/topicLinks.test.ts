import { describe, expect, it } from 'vitest';
import { unavailableIn } from './topicLinks';

describe('unavailableIn', () => {
  it('gives the reason a topic has nothing to show', () => {
    expect(unavailableIn({ unavailable: 'MOV worked nothing out.' })).toBe(
      'MOV worked nothing out.'
    );
  });

  it('is null for a link with something to show', () => {
    expect(unavailableIn({ request: {} })).toBeNull();
  });
});
