import { describe, expect, it } from 'vitest';
import { COMPARISON_TASKS } from '@/core/comparisonTasks';
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
