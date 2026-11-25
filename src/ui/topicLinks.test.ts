import { describe, expect, it } from 'vitest';
import type { NumberView } from '@/core/numberLink';
import { numbersLinkWhat, unavailableIn } from './topicLinks';

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

describe('numbersLinkWhat', () => {
  it('names an extension, and nothing else', () => {
    const extend: NumberView = {
      request: { kind: 'extend', value: 0x80, from: 8, to: 32, signed: true },
      flags: [],
      resultKept: true,
      comparable: false,
      note: null
    };
    expect(numbersLinkWhat(extend)).toBe('8 bits made 32');
    expect(
      numbersLinkWhat({ ...extend, request: { kind: 'value', width: 8, bits: 1 } })
    ).toBeNull();
    expect(numbersLinkWhat({ unavailable: 'No.' })).toBeNull();
  });
});
