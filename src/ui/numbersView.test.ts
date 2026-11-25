import { describe, expect, it } from 'vitest';
import { solveNumber, type NumberRequest } from '@/core/representation/request';
import type { ScalingRequest } from '@/core/representation/scaling';
import { execute as run6502 } from '@/core/mos6502/execute';
import type { Instruction as Mos6502Instruction } from '@/core/mos6502/instructions';
import { createCpuState as mos6502Cpu } from '@/core/mos6502/state';
import { mos6502NumberLink } from '@/core/mos6502NumberLink';
import { hasNumbers, type NumberLink } from '@/core/numberLink';
import { execute as runRv32 } from '@/core/rv32/execute';
import type { Instruction as Rv32Instruction } from '@/core/rv32/instructions';
import { createCpuState as rv32Cpu } from '@/core/rv32/state';
import { rv32NumberLink } from '@/core/rv32NumberLink';
import { execute as runX86 } from '@/core/x86/execute';
import type { Instruction as X86Instruction } from '@/core/x86/instructions';
import { createCpuState as x86Cpu } from '@/core/x86/state';
import { x86NumberLink } from '@/core/x86NumberLink';
import {
  bitsOf,
  flagsBothScales,
  lensLesson,
  bcdExtraFrom,
  disallowedWidths,
  widthReason,
  equationText,
  operandsText,
  flagsTitle,
  freeRequest,
  freeView,
  sameOperation,
  unavailableText,
  widthAllowed,
  widthOf,
  withBitFlipped,
  withExtraFlipped,
  withOperand
} from './numbersView';

const sum: NumberRequest = { kind: 'add', width: 8, a: 0x7f, b: 0x01, extra: 0 };
const text = (request: NumberRequest) => equationText(request, solveNumber(request));

describe('freeRequest', () => {
  it('starts from values that wrap on the signed scale', () => {
    expect(freeRequest('add', 8, null)).toEqual(sum);
  });

  it('keeps the operands when the lens changes, as far as they fit', () => {
    const wide: NumberRequest = { kind: 'add', width: 16, a: 0x1234, b: 0x00ff, extra: 1 };
    expect(freeRequest('subtract', 8, wide)).toEqual({
      kind: 'subtract',
      width: 8,
      a: 0x34,
      b: 0xff,
      extra: 0
    });
    expect(freeRequest('value', 16, wide)).toEqual({ kind: 'value', width: 16, bits: 0x1234 });
  });

  it('extends to at least 16 bits, from fewer bits than that', () => {
    expect(freeRequest('extend', 8, sum)).toMatchObject({ kind: 'extend', from: 8, to: 16 });
  });

  it('extends a value whose top bit is 1, where the two fills differ', () => {
    expect(freeRequest('extend', 8, sum)).toMatchObject({ value: 0x80 });
    expect(freeRequest('extend', 8, { ...sum, a: 0xf0 })).toMatchObject({ value: 0xf0 });
    expect(freeRequest('extend', 8, null)).toMatchObject({ value: 0x80 });
  });

  it('extends from fewer bits than its width, keeping what an extension held', () => {
    const fromWord: NumberRequest = {
      kind: 'extend',
      value: 0x8000,
      from: 16,
      to: 32,
      signed: false
    };
    expect(freeRequest('extend', 16, fromWord)).toMatchObject({ from: 8, to: 16, signed: false });
  });

  it('starts a decimal sum from decimal bytes only', () => {
    expect(freeRequest('bcd', 8, sum)).toMatchObject({ a: 0x19, b: 0x01 });
    expect(freeRequest('bcd', 8, { ...sum, a: 0x42 })).toMatchObject({ a: 0x42 });
  });
});

describe('widthOf', () => {
  it('is the width of the row a request ends in', () => {
    expect(widthOf(sum)).toBe(8);
    expect(widthOf({ kind: 'extend', value: 1, from: 8, to: 32, signed: true })).toBe(32);
    expect(widthOf({ kind: 'bcd', operation: 'add', a: 1, b: 2, extra: 0 })).toBe(8);
  });
});

describe('widthAllowed', () => {
  it('lets a sum be any width, an extension more than 8 bits, a decimal byte none', () => {
    expect(widthAllowed(sum, 32)).toBe(true);
    const extend: NumberRequest = { kind: 'extend', value: 1, from: 8, to: 16, signed: true };
    expect(widthAllowed(extend, 8)).toBe(false);
    expect(widthAllowed(extend, 32)).toBe(true);
    expect(widthAllowed({ kind: 'bcd', operation: 'add', a: 1, b: 2, extra: 0 }, 8)).toBe(false);
  });
});

describe('sameOperation', () => {
  it('ignores the values put in', () => {
    expect(sameOperation(sum, { ...sum, a: 3, extra: 1 })).toBe(true);
  });

  it('tells another kind, width, or way of extending apart', () => {
    expect(sameOperation(sum, { ...sum, kind: 'subtract' })).toBe(false);
    expect(sameOperation(sum, { ...sum, width: 16 })).toBe(false);
    const extend: NumberRequest = { kind: 'extend', value: 1, from: 8, to: 32, signed: true };
    expect(sameOperation(extend, { ...extend, signed: false })).toBe(false);
  });
});

describe('changing a request', () => {
  it('flips one bit of an operand', () => {
    expect(withBitFlipped(sum, 'a', 7)).toMatchObject({ a: 0xff });
    expect(withBitFlipped(sum, 'b', 0)).toMatchObject({ b: 0 });
    expect(withBitFlipped({ kind: 'value', width: 32, bits: 0 }, 'a', 31)).toMatchObject({
      bits: 0x80000000
    });
  });

  it('keeps a new value to the bits the operand has', () => {
    expect(withOperand(sum, 'a', 0x1ff)).toMatchObject({ a: 0xff });
    expect(withOperand(sum, 'a', -1)).toMatchObject({ a: 0xff });
    const extend: NumberRequest = { kind: 'extend', value: 1, from: 8, to: 32, signed: true };
    expect(withOperand(extend, 'a', 0x180)).toMatchObject({ value: 0x80 });
  });

  it('flips the carry coming in', () => {
    expect(withExtraFlipped(sum)).toMatchObject({ extra: 1 });
  });
});

describe('freeView', () => {
  it('names the flags plainly', () => {
    expect(freeView(sum).flags.map((flag) => flag.flag)).toEqual([
      'Carry',
      'Overflow',
      'Zero',
      'Negative'
    ]);
    expect(freeView({ ...sum, kind: 'subtract' }).flags[0].flag).toBe('Borrow');
    expect(freeView({ kind: 'value', width: 8, bits: 0 }).flags).toEqual([]);
  });
});

describe('equationText', () => {
  it('writes each operation on one line', () => {
    expect(text(sum)).toBe('0x7F + 0x01 = 0x80');
    expect(text({ kind: 'subtract', width: 8, a: 3, b: 5, extra: 1 })).toBe(
      '0x03 − 0x05 − 1 = 0xFD'
    );
    expect(text({ kind: 'extend', value: 0x80, from: 8, to: 16, signed: true })).toBe(
      '0x80 → 0xFF80, copying the top bit'
    );
    expect(text({ kind: 'bcd', operation: 'add', a: 0x19, b: 0x03, extra: 0 })).toBe(
      '19 + 03 = 22 in decimal digits'
    );
    expect(text({ kind: 'value', width: 16, bits: 0x41 })).toBe('0x0041');
  });
});

describe('bitsOf', () => {
  it('lists the bits from bit 0', () => {
    expect(bitsOf(0b0110, 4)).toEqual([0, 1, 1, 0]);
    expect(bitsOf(0x80000000, 32)[31]).toBe(1);
  });
});

describe('the shift lens', () => {
  const shift: ScalingRequest = {
    kind: 'shift',
    width: 8,
    value: 0x7f,
    direction: 'left',
    fill: 'zero',
    count: 1
  };

  it('starts as one place to the left, from the value on show', () => {
    expect(freeRequest('shift', 8, null)).toEqual(shift);
    expect(
      freeRequest('shift', 16, { kind: 'add', width: 16, a: 0x1234, b: 1, extra: 0 })
    ).toMatchObject({
      value: 0x1234
    });
  });

  it('keeps its direction, fill and places across a change of width', () => {
    const wide = { ...shift, width: 32, direction: 'right', fill: 'sign', count: 20 } as const;
    expect(freeRequest('shift', 8, wide)).toMatchObject({
      direction: 'right',
      fill: 'sign',
      count: 8
    });
  });

  it('notes the carry and the overflow after one place only', () => {
    const names = (request: ScalingRequest) => freeView(request).flags.map((flag) => flag.flag);
    expect(names(shift)).toEqual(['Carry', 'Overflow', 'Zero', 'Negative']);
    expect(names({ ...shift, direction: 'right' })).toEqual(['Carry', 'Zero', 'Negative']);
    expect(names({ ...shift, count: 2 })).toEqual(['Zero', 'Negative']);
  });

  it('is another operation once its direction, fill or places change', () => {
    expect(sameOperation(shift, { ...shift, value: 3 })).toBe(true);
    expect(sameOperation(shift, { ...shift, count: 2 })).toBe(false);
    expect(sameOperation(shift, { ...shift, direction: 'right' })).toBe(false);
    expect(
      sameOperation(
        { ...shift, direction: 'right' },
        { ...shift, direction: 'right', fill: 'sign' }
      )
    ).toBe(false);
  });

  it('flips a bit of its value', () => {
    expect(withBitFlipped(shift, 'a', 7)).toMatchObject({ value: 0xff });
  });

  it('writes the shift on one line', () => {
    const text = (request: ScalingRequest) => equationText(request, solveNumber(request));
    expect(text(shift)).toBe('0x7F << 1 = 0xFE');
    expect(text({ ...shift, value: 0xf9, direction: 'right', fill: 'sign' })).toBe(
      '0xF9 >> 1 = 0xFC, copying the top bit'
    );
  });
});

describe('unavailableText', () => {
  it('says why an instruction has no numbers, and what the numbers on show are', () => {
    expect(unavailableText({ unavailable: 'A rotate is not arithmetic.' })).toBe(
      'A rotate is not arithmetic. The numbers on show are ones to try by hand.'
    );
  });

  it('has nothing to say before an instruction ran', () => {
    expect(unavailableText(null)).toBeNull();
  });
});

describe('widthReason', () => {
  it('says why only where a width is off', () => {
    expect(widthReason(freeRequest('bcd', 8, null))).toMatch(/one byte/);
    expect(widthReason(freeRequest('extend', 16, null))).toMatch(/wider than the 8 bits/);
    expect(widthReason(freeRequest('add', 16, null))).toBeNull();
  });
});

describe('disallowedWidths', () => {
  it('lets a sum be any width', () => {
    expect(disallowedWidths(sum)).toEqual([]);
  });

  it('keeps a decimal byte at its one width', () => {
    expect(disallowedWidths(freeRequest('bcd', 8, null))).toEqual([8, 16, 32]);
  });

  it('does not let an extension be as narrow as what it extends', () => {
    expect(disallowedWidths(freeRequest('extend', 16, null))).toEqual([8]);
  });
});

describe('flagsBothScales', () => {
  const both = (link: NumberLink) => hasNumbers(link) && flagsBothScales(link);
  const x86 = (instruction: X86Instruction) => x86NumberLink(runX86(x86Cpu(), instruction));
  const mos6502 = (instruction: Mos6502Instruction) =>
    mos6502NumberLink(run6502(mos6502Cpu(), instruction, null, [instruction]));

  it('is true only where a flag says each scale’s answer did not fit', () => {
    const ax = { type: 'reg', name: 'ax' } as const;
    expect(both(x86({ mnemonic: 'sub', operands: [ax, { type: 'imm', value: 3 }] }))).toBe(true);
    expect(both(x86({ mnemonic: 'inc', operands: [ax] }))).toBe(false);
  });

  it('is false on RISC-V, which keeps no flags', () => {
    const reg = (index: number) => ({ type: 'reg', index }) as const;
    const sub: Rv32Instruction = { mnemonic: 'sub', operands: [reg(7), reg(5), reg(6)] };
    expect(both(rv32NumberLink(runRv32(rv32Cpu(), sub, null, [sub])))).toBe(false);
  });

  it('tells the 6502’s SBC from its CMP', () => {
    const imm = { type: 'imm', value: 3 } as const;
    expect(both(mos6502({ mnemonic: 'sbc', operands: [imm] }))).toBe(true);
    expect(both(mos6502({ mnemonic: 'cmp', operands: [imm] }))).toBe(false);
  });

  it('decides whether the lesson speaks of a flag for each scale', () => {
    const request: NumberRequest = { kind: 'subtract', width: 32, a: 5, b: 3, extra: 0 };
    expect(lensLesson(request, true)).toContain('a flag for each');
    expect(lensLesson(request, false)).not.toContain('flag');
  });
});

describe('bcdExtraFrom', () => {
  it('says where the one more of a digit comes from', () => {
    expect(bcdExtraFrom('tens', true)).toBe('carried from the ones');
    expect(bcdExtraFrom('tens', false)).toBe('borrowed by the ones');
    expect(bcdExtraFrom('ones', false)).toBe('the borrow coming in');
  });
});

describe('a request made by hand on a CPU', () => {
  const difference: NumberRequest = { kind: 'subtract', width: 8, a: 1, b: 2, extra: 0 };

  it('goes by the flags of the CPU on show', () => {
    expect(freeView(difference, 'mos6502').flags.map((flag) => flag.flag)).toEqual([
      'C',
      'V',
      'Z',
      'N'
    ]);
    expect(freeView(difference, 'x86').flags[0].flag).toBe('CF');
    expect(freeView(difference, 'rv32').flags).toEqual([]);
  });

  it('titles the section by what the CPU keeps', () => {
    expect(flagsTitle(freeView(difference, 'rv32'), false, 'RISC-V')).toBe(
      'What the instruction decides'
    );
    expect(flagsTitle(freeView(difference, 'mos6502'), false, '6502')).toBe(
      'What the 6502 would note'
    );
    expect(flagsTitle(freeView(difference, 'x86'), true, '8086')).toBe('What each flag says');
  });

  it('says what A and B are only while the operation is the CPU own', () => {
    const view = { ...freeView(difference, 'mos6502'), operands: { a: 'X', b: '#$05' } };
    expect(operandsText(view, true)).toBe('A is X and B is #$05, as the instruction wrote them.');
    expect(operandsText(view, false)).toBeNull();
  });
});
