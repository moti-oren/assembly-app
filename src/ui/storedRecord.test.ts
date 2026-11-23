import { describe, expect, it } from 'vitest';
import { isStoredCount, isStoredText, readStoredRecord } from './storedRecord';

describe('readStoredRecord', () => {
  it('keeps the entries whose values are of the kind asked for', () => {
    expect(readStoredRecord('{"a":"x","b":3,"c":null}', isStoredText)).toEqual({ a: 'x' });
    expect(readStoredRecord('{"a":"x","b":3,"c":-1,"d":1.5}', isStoredCount)).toEqual({ b: 3 });
  });

  it('is empty for anything that is not a record', () => {
    for (const raw of ['not json', 'null', '[1, 2]', '"text"', '7']) {
      expect(readStoredRecord(raw, isStoredText), raw).toEqual({});
    }
  });
});
