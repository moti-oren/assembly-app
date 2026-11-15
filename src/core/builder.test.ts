import { describe, expect, it } from 'vitest';
import { hasMoreOperands, operandChoices } from './builder';
import { isComplete } from './instructions';
import { fitsIn, formatBinary, formatHex, parseNumber, toSigned } from './numbers';
import type { Operand } from './operands';

const reg = (name: Extract<Operand, { type: 'reg' }>['name']): Operand => ({ type: 'reg', name });

describe('operandChoices', () => {
  it('offers every writable destination for mov', () => {
    const choices = operandChoices('mov', []);
    expect(choices.registers).toContain('ax');
    expect(choices.registers).toContain('al');
    expect(choices.registers).toContain('ds');
    expect(choices.registers).not.toContain('cs');
    expect(choices.registers).not.toContain('ip');
    expect(choices.immediate).toBeNull();
    expect(choices.memory).toEqual([8, 16]);
  });

  it('narrows the source to the size of the destination', () => {
    const choices = operandChoices('mov', [reg('al')]);
    expect(choices.registers).toContain('bl');
    expect(choices.registers).not.toContain('bx');
    expect(choices.registers).not.toContain('ds');
    expect(choices.immediate).toBe(8);
    expect(choices.memory).toEqual([8]);
  });

  it('does not allow memory to memory', () => {
    const choices = operandChoices('add', [{ type: 'mem', size: 16, base: 'bx', displacement: 0 }]);
    expect(choices.memory).toEqual([]);
    expect(choices.immediate).toBe(16);
  });

  it('limits shift counts to 1 or CL', () => {
    const choices = operandChoices('shl', [reg('ax')]);
    expect(choices.registers).toEqual(['cl']);
    expect(choices.one).toBe(true);
    expect(choices.immediate).toBeNull();
  });

  it('knows when an instruction is complete', () => {
    expect(isComplete('mov', [reg('ax')])).toBe(false);
    expect(isComplete('mov', [reg('ax'), reg('bx')])).toBe(true);
    expect(isComplete('clc', [])).toBe(true);
    expect(hasMoreOperands('inc', [reg('ax')])).toBe(false);
    expect(hasMoreOperands('mul', [])).toBe(true);
  });
});

describe('numbers', () => {
  it.each([
    ['42', 42],
    ['-5', -5],
    ['0x2A', 42],
    ['2Ah', 42],
    ['0FFh', 255],
    ['0b101', 5],
    ['101b', 5],
    ['1_000', 1000],
    ['abc', null],
    ['', null]
  ])('parseNumber(%s) = %s', (text, expected) => {
    expect(parseNumber(text)).toBe(expected);
  });

  it('formats and converts', () => {
    expect(formatHex(255, 16)).toBe('00FF');
    expect(formatBinary(5, 8)).toBe('0000 0101');
    expect(toSigned(0xff, 8)).toBe(-1);
    expect(fitsIn(-128, 8)).toBe(true);
    expect(fitsIn(256, 8)).toBe(false);
  });
});
