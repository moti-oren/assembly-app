import { describe, expect, it } from 'vitest';
import { withoutBits, withoutModBits } from './x86EncodingView';

describe('withoutModBits', () => {
  it('drops the bits in front of the meaning', () => {
    expect(withoutModBits('11: r/m is a register')).toBe('r/m is a register');
    expect(withoutModBits('00 with r/m 110: a direct address follows')).toBe(
      'r/m 110: a direct address follows'
    );
  });
});

describe('withoutBits', () => {
  it('drops the bits and the equals sign', () => {
    expect(withoutBits('001 = CX')).toBe('CX');
    expect(withoutBits('110 = [BP]')).toBe('[BP]');
  });
});
