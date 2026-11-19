import { describe, expect, it } from 'vitest';
import { COMPARISON_TASKS } from '@/core/comparisonTasks';
import { MOS6502_ENCODING_TEXTS } from '@/core/mos6502/encodingTexts';
import { RV32_ENCODING_TEXTS } from '@/core/rv32/encodingTexts';
import { ENCODING_TEXTS } from '@/core/x86/encodingTexts';
import { FLAG_REASON_TEXTS } from '@/core/x86/flagReasonTexts';
import { decode } from '@/core/x86/decode';
import { X86 } from '@/core/x86/architecture';
import { RV32 } from '@/core/rv32/architecture';
import { MOS6502 } from '@/core/mos6502/architecture';
import { FLAG_NAMES } from '@/core/x86/flags';
import { MNEMONICS as X86_MNEMONICS } from '@/core/x86/instructions';
import { MNEMONICS as RV32_MNEMONICS } from '@/core/rv32/instructions';
import { PSEUDO_MNEMONICS } from '@/core/rv32/pseudo';
import { MNEMONICS as MOS6502_MNEMONICS } from '@/core/mos6502/instructions';
import { LOCALES, messagesFor } from './locale';
import {
  MOS6502_ENCODING_TEXTS as HEBREW_6502,
  RV32_ENCODING_TEXTS as HEBREW_RV32,
  X86_ENCODING_TEXTS as HEBREW_X86
} from './messages/he/encodingTexts';
import { FLAG_REASON_TEXTS as HEBREW_FLAG_REASONS } from './messages/he/flagReasons';

describe('instruction texts', () => {
  it('describe every instruction of every architecture in every language', () => {
    for (const locale of LOCALES) {
      const m = messagesFor(locale);
      for (const mnemonic of X86_MNEMONICS) expect(m.x86Text.description(mnemonic)).not.toBe('');
      for (const mnemonic of RV32_MNEMONICS) expect(m.rv32Text.description(mnemonic)).not.toBe('');
      for (const mnemonic of PSEUDO_MNEMONICS) expect(m.rv32Text.pseudo(mnemonic)).not.toBe('');
      for (const mnemonic of MOS6502_MNEMONICS) {
        expect(m.mos6502Text.description(mnemonic)).not.toBe('');
      }
      for (const flag of FLAG_NAMES) expect(m.x86Text.flagLabel(flag)).not.toBe('');
    }
  });

  it('read in English as the core writes them', () => {
    const m = messagesFor('en');
    expect(m.x86Text.description('add')).toBe('dst = dst + src');
    expect(m.x86Text.category('string')).toBe('String');
    expect(m.mos6502Text.description('lda')).toBe('A = the operand');
  });

  it('put the repeat prefix in front of the instruction it repeats', () => {
    const decoded = decode({ prefix: 'rep', mnemonic: 'stosb', operands: [] });
    expect(messagesFor('en').x86Text.description(decoded.mnemonic, decoded.prefix)).toBe(
      'Repeat CX times: Store AL at ES:DI, then step DI'
    );
    expect(messagesFor('he').x86Text.description(decoded.mnemonic, decoded.prefix)).toContain('CX');
  });

  it('are translated into Hebrew', () => {
    const he = messagesFor('he');
    expect(he.x86Text.category('string')).toBe('מחרוזות');
    expect(he.mos6502Text.description('lda')).toBe('A = האופרנד');
  });
});

describe('example and task texts', () => {
  const architectures = { x86: X86, rv32: RV32, mos6502: MOS6502 } as const;

  it('exist in Hebrew for every example and every comparison task', () => {
    const he = messagesFor('he');
    const en = messagesFor('en');
    for (const [id, architecture] of Object.entries(architectures)) {
      for (const example of architecture.examples) {
        const key = id as keyof typeof architectures;
        expect(he.examples.name(key, example.id), `${id}/${example.id}`).not.toBe(example.name);
        expect(he.examples.description(key, example.id), `${id}/${example.id}`).not.toBe(
          example.description
        );
        expect(en.examples.name(key, example.id)).toBe(example.name);
      }
    }
    for (const task of COMPARISON_TASKS) {
      expect(he.tasks.name(task.id), task.id).not.toBe(task.name);
      expect(he.tasks.lesson(task.id), task.id).not.toBe(task.lesson);
      expect(en.tasks.lesson(task.id)).toBe(task.lesson);
    }
  });

  it('give every example of an architecture an id of its own', () => {
    for (const architecture of Object.values(architectures)) {
      const ids = architecture.examples.map((example) => example.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('flag reasons', () => {
  const holes = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('fill the same holes in Hebrew as in English', () => {
    for (const key of Object.keys(FLAG_REASON_TEXTS) as (keyof typeof FLAG_REASON_TEXTS)[]) {
      expect(holes(HEBREW_FLAG_REASONS[key]), key).toEqual(holes(FLAG_REASON_TEXTS[key]));
    }
  });

  it('are worded in the language of the interface', () => {
    const params = { result: '00h' };
    expect(messagesFor('en').x86Text.flagReason('zero', params)).toBe('The result 00h is zero.');
    expect(messagesFor('he').x86Text.flagReason('zero', params)).toContain('00h');
    expect(messagesFor('he').x86Text.flagReason('zero', params)).toContain('אפס');
  });
});

describe('machine code texts', () => {
  const holes = (template: string) =>
    [...template.matchAll(/\{(\w+)\}/g)].map((hole) => hole[1]).sort();

  function sameHoles(english: Record<string, string>, hebrew: Record<string, string>): void {
    for (const key of Object.keys(english)) {
      expect(holes(hebrew[key]), key).toEqual(holes(english[key]));
    }
  }

  it('fill the same holes in Hebrew as in English, for every architecture', () => {
    sameHoles(ENCODING_TEXTS, HEBREW_X86);
    sameHoles(RV32_ENCODING_TEXTS, HEBREW_RV32);
    sameHoles(MOS6502_ENCODING_TEXTS, HEBREW_6502);
  });

  it('word a field in the language of the interface', () => {
    const he = messagesFor('he');
    expect(he.x86Text.encoding('portNumber', {})).toBe('מספר הפורט');
    expect(messagesFor('en').x86Text.encoding('portNumber', {})).toBe('The port number');
    expect(he.mos6502Text.encoding('cyclesPage', { cycles: 4 })).toContain('4');
    expect(he.rv32Text.encoding('register', { abi: 'a0', index: 10 })).toBe('a0 (x10)');
  });
});
