import { describe, expect, it } from 'vitest';
import { MOS6502_DEVICE_ACCESS, RV32_DEVICE_ACCESS, X86_DEVICE_ACCESS } from './deviceAccess';

describe('the device access of each CPU', () => {
  it('writes a byte in the notation of its own programs and panels', () => {
    expect(X86_DEVICE_ACCESS.byte(0x80)).toBe('80h');
    expect(RV32_DEVICE_ACCESS.byte(0x80)).toBe('0x80');
    expect(MOS6502_DEVICE_ACCESS.byte(0x80)).toBe('$80');
  });
});
