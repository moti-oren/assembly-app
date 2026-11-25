import { describe, expect, it } from 'vitest';
import { HEX_STYLES } from './hexNotation';

describe('HEX_STYLES', () => {
  it('writes a number the way each CPU writes it', () => {
    expect(HEX_STYLES.x86('2A')).toBe('2Ah');
    expect(HEX_STYLES.x86('FF')).toBe('0FFh');
    expect(HEX_STYLES.rv32('2A')).toBe('0x2A');
    expect(HEX_STYLES.mos6502('2A')).toBe('$2A');
  });
});
