import { describe, expect, it } from 'vitest';
import { littleEndian } from './numbers';

describe('littleEndian', () => {
  it('puts the first byte lowest', () => {
    expect(littleEndian([0x34, 0x12])).toBe(0x1234);
    expect(littleEndian([0xff])).toBe(0xff);
    expect(littleEndian([])).toBe(0);
  });
});
