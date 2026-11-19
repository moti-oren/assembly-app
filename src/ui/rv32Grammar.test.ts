import { describe, expect, it } from 'vitest';
import { formatInstruction } from '@/core/rv32/instructions';
import { filterOptions, type DraftContext } from './builderGrammar';
import { RV32_GRAMMAR, type Rv32Action } from './rv32Grammar';
import { messagesFor } from './locale';

const m = messagesFor('en');

const none: DraftContext = { typed: null, programLines: [], messages: m };
const reg = (index: number): Rv32Action => ({ kind: 'operand', operand: { type: 'reg', index } });
const imm = (value: number): Rv32Action => ({ kind: 'operand', operand: { type: 'imm', value } });
const labels = (chosen: Rv32Action[], context = none) =>
  RV32_GRAMMAR.options(chosen, context).map((option) => option.label);
const built = (chosen: Rv32Action[]) => RV32_GRAMMAR.build(chosen)?.map(formatInstruction) ?? null;

const addi: Rv32Action = { kind: 'mnemonic', mnemonic: 'addi' };
const lw: Rv32Action = { kind: 'mnemonic', mnemonic: 'lw' };
const li: Rv32Action = { kind: 'pseudo', mnemonic: 'li' };

describe('RV32_GRAMMAR', () => {
  it('offers the real instructions, then the pseudo-instructions', () => {
    const options = RV32_GRAMMAR.options([], none);
    expect(options[0].label).toBe('add');
    expect(options.at(-1)?.group).toMatch(/^Pseudo-instructions/);
    expect(filterOptions(options, 'li', null).map((option) => option.label)[0]).toBe('li');
  });

  it('offers the registers by their ABI names, grouped by role', () => {
    const options = RV32_GRAMMAR.options([addi], none);
    expect(options.length).toBe(32);
    expect(options[10]).toMatchObject({
      label: 'a0',
      group: 'Arguments and return values (a0–a7)'
    });
  });

  it('offers a typed immediate only when it fits', () => {
    expect(labels([addi, reg(10), reg(10)], { ...none, typed: -5 })).toEqual(['-5']);
    expect(labels([addi, reg(10), reg(10)], { ...none, typed: 2048 })).toEqual([]);
    expect(RV32_GRAMMAR.overflows([addi, reg(10), reg(10)], { ...none, typed: 2048 })).toBe(true);
    expect(
      RV32_GRAMMAR.hint([addi, reg(10), reg(10)], { ...none, typed: 2048 }, '2048', false)
    ).toBe('2048 does not fit: 12-bit, -2048 to 2047');
  });

  it('builds offset(base) from a typed offset and then the register', () => {
    const offered = labels([lw, reg(10)], { ...none, typed: 8 });
    expect(offered[0]).toBe('8( )');
    const chosen: Rv32Action[] = [lw, reg(10), { kind: 'offset', offset: 8 }];
    expect(RV32_GRAMMAR.tokens(chosen).at(-1)).toEqual({ label: '8( ? )', pending: true, keep: 2 });
    expect(labels(chosen)[2]).toBe('8(sp)');
    const done = [
      ...chosen,
      { kind: 'operand', operand: { type: 'mem', base: 2, offset: 8 } } as const
    ];
    expect(built(done)).toEqual(['lw a0, 8(sp)']);
    expect(RV32_GRAMMAR.tokens(done).map((token) => token.label)).toEqual(['lw', 'a0', '8(sp)']);
  });

  it('offers base registers with offset 0 when no offset is typed', () => {
    expect(labels([lw, reg(10)]).slice(0, 3)).toEqual(['0(zero)', '0(ra)', '0(sp)']);
  });

  it('expands a pseudo-instruction into the real ones it stands for', () => {
    expect(RV32_GRAMMAR.hasMore([li, reg(10)])).toBe(true);
    expect(built([li, reg(10), imm(0x12345)])).toEqual(['lui a0, 0x12', 'addi a0, a0, 0x345']);
    expect(RV32_GRAMMAR.describe([li, reg(10), imm(0x12345)], m)?.text).toBe(
      'becomes lui a0, 0x12, then addi a0, a0, 0x345'
    );
    expect(RV32_GRAMMAR.describe([li], m)?.text).toBe('rd = any 32-bit value');
  });

  it('accepts any 32-bit value for LI', () => {
    expect(labels([li, reg(10)], { ...none, typed: 0xdeadbeef })).toEqual(['0xdeadbeef']);
  });

  it('describes a real instruction with its format', () => {
    expect(RV32_GRAMMAR.describe([addi], m)).toEqual({
      label: 'addi',
      text: 'rd = rs1 + imm (I-type)'
    });
  });
});
