import { describe, expect, it } from 'vitest';
import { parseRegister, registerRole } from './registers';

describe('registers', () => {
  it('accepts x names, ABI names and fp', () => {
    expect(parseRegister('x10')).toBe(10);
    expect(parseRegister('a0')).toBe(10);
    expect(parseRegister('fp')).toBe(8);
    expect(parseRegister('x32')).toBeNull();
  });

  it('groups the registers by what the calling convention uses them for', () => {
    expect(
      ['zero', 'ra', 'sp', 'gp', 'tp'].map((name) => registerRole(parseRegister(name)!))
    ).toEqual(Array(5).fill('special'));
    expect(registerRole(parseRegister('a7')!)).toBe('argument');
    expect(registerRole(parseRegister('t6')!)).toBe('temporary');
    expect(registerRole(parseRegister('s0')!)).toBe('saved');
    expect(registerRole(parseRegister('s11')!)).toBe('saved');
  });
});
