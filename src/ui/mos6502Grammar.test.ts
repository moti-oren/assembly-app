import { describe, expect, it } from 'vitest';
import { MOS6502 } from '@/core/mos6502/architecture';
import { formatInstruction } from '@/core/mos6502/instructions';
import type { DraftContext } from './builderGrammar';
import { MOS6502_GRAMMAR, type Mos6502Action } from './mos6502Grammar';

const none: DraftContext = { typed: null, programLines: [] };
const typed = (value: number): DraftContext => ({ ...none, typed: value });
const mnemonic = (name: 'lda' | 'ldx' | 'asl' | 'jmp' | 'bne' | 'clc' | 'sta'): Mos6502Action => ({
  kind: 'mnemonic',
  mnemonic: name
});
const labels = (chosen: Mos6502Action[], context = none) =>
  MOS6502_GRAMMAR.options(chosen, context).map((option) => option.label);
const built = (chosen: Mos6502Action[]) =>
  MOS6502_GRAMMAR.build(chosen)?.map(formatInstruction) ?? null;

describe('MOS6502_GRAMMAR', () => {
  it('offers every addressing mode a typed number fits', () => {
    expect(labels([mnemonic('lda')], typed(0x10))).toEqual([
      '#$10',
      '$10',
      '$10,x',
      '$0010',
      '$0010,x',
      '$0010,y',
      '($10,x)',
      '($10),y'
    ]);
    expect(labels([mnemonic('lda')], typed(0x1234))).toEqual(['$1234', '$1234,x', '$1234,y']);
    expect(labels([mnemonic('ldx')], typed(0x10))).toContain('$10,y');
    expect(labels([mnemonic('sta')], typed(0x10))).not.toContain('#$10');
  });

  it('says what each mode means and what it costs', () => {
    const [, zeroPageX] = MOS6502_GRAMMAR.options([mnemonic('lda')], typed(0x10)).slice(1);
    expect(zeroPageX.hint).toBe('4 cycles · the byte at $10 + X, wrapping around in the zero page');
    const absoluteX = MOS6502_GRAMMAR.options([mnemonic('lda')], typed(0x10))[4];
    expect(absoluteX.hint).toBe('4 cycles, +1 across a page · the byte at $0010 + X');
  });

  it('offers A for the shifts, and lines for branches and jumps', () => {
    expect(labels([mnemonic('asl')])).toEqual(['a']);
    expect(labels([mnemonic('bne')], { ...none, programLines: ['nop'] })).toEqual(['L0', 'L1']);
    expect(labels([mnemonic('jmp')], { ...none, programLines: ['nop'], typed: 0x0300 })).toEqual([
      'L0',
      'L1',
      '($0300)'
    ]);
  });

  it('builds an instruction once its operand is chosen, or at once when it takes none', () => {
    expect(MOS6502_GRAMMAR.hasMore([mnemonic('clc')])).toBe(false);
    expect(built([mnemonic('clc')])).toEqual(['clc']);
    const [option] = MOS6502_GRAMMAR.options([mnemonic('lda')], typed(0x42));
    expect(built([mnemonic('lda'), option.action])).toEqual(['lda #$42']);
  });

  it('says when a number fits none of the modes', () => {
    expect(MOS6502_GRAMMAR.overflows([mnemonic('lda')], typed(0x10000))).toBe(true);
    expect(MOS6502_GRAMMAR.hint([mnemonic('lda')], typed(0x10000), '$10000', false)).toBe(
      "$10000 fits none of lda's addressing modes"
    );
  });

  it('describes the chosen mode with its opcode and cycles', () => {
    const chosen: Mos6502Action[] = [
      mnemonic('lda'),
      { kind: 'operand', operand: { type: 'izy', address: 0x10 } }
    ];
    expect(MOS6502_GRAMMAR.describe(chosen)?.text).toBe(
      'A = the operand · (indirect),Y, opcode $B1, 5 cycles, +1 across a page'
    );
    expect(MOS6502_GRAMMAR.describe([mnemonic('asl')])?.text).toBe(
      'Shift left; bit 7 goes to C. Modes: accumulator, zero page, zero page,X, absolute, absolute,X'
    );
  });
});

describe('parse', () => {
  it('gives back the words of every line of the examples', () => {
    for (const example of MOS6502.examples) {
      for (const instruction of example.program) {
        const words = MOS6502_GRAMMAR.parse(instruction);
        expect(MOS6502_GRAMMAR.build(words)).toEqual([instruction]);
        expect(MOS6502_GRAMMAR.hasMore(words)).toBe(false);
      }
    }
  });
});
