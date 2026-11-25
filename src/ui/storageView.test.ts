import { describe, expect, it } from 'vitest';
import { written } from '@/core/registerLink';
import {
  keptBits,
  phaseText,
  cellLabel,
  equationText,
  freeWrite,
  registerChoices,
  registerTitle,
  unavailableText,
  withBitFlipped
} from './storageView';

describe('freeWrite', () => {
  it('starts with every bit written', () => {
    expect(freeWrite(8, null).request).toEqual({
      width: 8,
      held: 0x3c,
      input: 0xa5,
      enabled: 0xff
    });
  });

  it('keeps the values that fit a narrower register, and writes all of it', () => {
    const wide = { width: 16, held: 0x1234, input: 0xabcd, enabled: 0x00ff } as const;
    expect(freeWrite(8, wide).request).toEqual({
      width: 8,
      held: 0x34,
      input: 0xcd,
      enabled: 0xff
    });
  });

  it('keeps which bits are written while the width stays', () => {
    const half = { width: 16, held: 0x1234, input: 0xabcd, enabled: 0x00ff } as const;
    expect(freeWrite(16, half).request.enabled).toBe(0x00ff);
  });
});

describe('withBitFlipped', () => {
  const request = { width: 32, held: 0, input: 0, enabled: 0xffffffff } as const;

  it('flips one bit of the input', () => {
    expect(withBitFlipped(request, 'input', 31).input).toBe(0x80000000);
  });

  it('flips one write line', () => {
    expect(withBitFlipped(request, 'enabled', 0).enabled).toBe(0xfffffffe);
  });
});

describe('equationText', () => {
  it('says what the register held and what it holds', () => {
    expect(equationText(written('AX', 16, 0x1234, 0xbeef), 0xbeef)).toBe('AX: 0x1234 → 0xBEEF');
  });

  it('names the part that was written', () => {
    const write = written('AX', 16, 0x1234, 0x12ff, 0x00ff, 'AL');
    expect(equationText(write, 0x12ff)).toBe('AX: 0x1234 → 0x12FF (only AL is written)');
  });
});

describe('unavailableText', () => {
  it('says why, and what the page shows instead', () => {
    expect(unavailableText({ unavailable: 'NOP wrote no register.' })).toBe(
      'NOP wrote no register. The register on show is one to try by hand.'
    );
  });

  it('is null with a register to show, and before anything ran', () => {
    expect(unavailableText({ writes: [written('AX', 16, 0, 1)], note: null })).toBeNull();
    expect(unavailableText(null)).toBeNull();
  });
});

describe('registerChoices', () => {
  it('offers a choice only between several registers', () => {
    const ax = written('AX', 16, 0, 1);
    const bx = written('BX', 16, 1, 0);
    expect(registerChoices([ax])).toEqual([]);
    expect(registerChoices([ax, bx])).toEqual([ax, bx]);
  });
});

describe('cellLabel', () => {
  it('names a cell', () => {
    expect(cellLabel('flipFlop')).toBe('Flip-flop');
  });
});

describe('registerTitle', () => {
  it('counts the flip-flops', () => {
    expect(registerTitle(written('a0', 32, 0, 1))).toBe('a0: 32 flip-flops');
  });
});

describe('phaseText', () => {
  const request = { width: 8, held: 0x33, input: 0xa5, enabled: 0xff } as const;

  it('says the new value is held only when a write line let it in', () => {
    expect(phaseText('after', request)).toContain('holds the new value');
    const none = phaseText('after', { ...request, enabled: 0 });
    expect(none).not.toContain('new value');
    expect(none).toContain('still holds what it held');
    expect(phaseText('high', { ...request, enabled: 0 })).toContain('nothing changed');
  });

  it('says which bits were written when only some were', () => {
    expect(phaseText('after', { ...request, enabled: 0x0f })).toContain(
      'the others what they held'
    );
  });
});

describe('keptBits', () => {
  it('marks the bits whose write line is off, bit 0 first', () => {
    expect(keptBits({ width: 8, held: 0, input: 0, enabled: 0x0f })).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true
    ]);
  });
});
