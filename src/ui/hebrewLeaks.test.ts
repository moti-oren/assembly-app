import { describe, expect, it } from 'vitest';
import { MOS6502 } from '@/core/mos6502/architecture';
import { assemble as assembleMos6502 } from '@/core/mos6502/encode';
import { RV32 } from '@/core/rv32/architecture';
import { assemble as assembleRv32 } from '@/core/rv32/encode';
import { X86 } from '@/core/x86/architecture';
import { assemble as assembleX86 } from '@/core/x86/encode';
import { explainFlag } from '@/core/x86/flagReasons';
import { FLAG_NAMES } from '@/core/x86/flags';
import { execute } from '@/core/x86/execute';
import { createCpuState } from '@/core/x86/state';
import { messagesFor } from './locale';

/** Three plain lower-case English words in a row: a sentence, not a term such as "zero page". */
const ENGLISH_SENTENCE = /\b[a-z]{3,}\b +\b[a-z]{2,}\b +\b[a-z]{2,}\b/;

const he = messagesFor('he');

function expectHebrew(text: string, where: string): void {
  expect(text, where).not.toMatch(ENGLISH_SENTENCE);
}

describe('the Hebrew interface', () => {
  it('words every field of the machine code of every 8086 example in Hebrew', () => {
    for (const example of X86.examples) {
      for (const line of assembleX86(example.program).lines) {
        for (const field of line.encoding.fields) {
          expectHebrew(he.x86Text.encoding(field.say.key, field.say.params), example.id);
          if (field.modrm) {
            for (const said of [field.modrm.modSay, field.modrm.regSay, field.modrm.rmSay]) {
              expectHebrew(he.x86Text.encoding(said.key, said.params), example.id);
            }
          }
        }
      }
    }
  });

  it('words every field of the machine code of every RISC-V and 6502 example in Hebrew', () => {
    for (const example of RV32.examples) {
      for (const line of assembleRv32(example.program).lines) {
        for (const field of line.encoding.fields) {
          expectHebrew(he.rv32Text.encoding(field.say.key, field.say.params), example.id);
        }
      }
    }
    for (const example of MOS6502.examples) {
      for (const line of assembleMos6502(example.program).lines) {
        for (const field of line.encoding.fields) {
          expectHebrew(he.mos6502Text.encoding(field.say.key, field.say.params), example.id);
        }
        const { cyclesSay } = line.encoding;
        if (cyclesSay)
          expectHebrew(he.mos6502Text.encoding(cyclesSay.key, cyclesSay.params), example.id);
      }
    }
  });

  it('words the reason for every flag of a run of every 8086 example in Hebrew', () => {
    for (const example of X86.examples) {
      const state = createCpuState();
      const records = example.program
        .slice(0, 6)
        .filter((instruction) => !['int', 'iret', 'in', 'out'].includes(instruction.mnemonic))
        .map((instruction, line) => {
          try {
            return execute(state, instruction, line);
          } catch {
            return null;
          }
        });
      for (const record of records) {
        if (!record) continue;
        for (const flag of FLAG_NAMES) {
          const { key, params } = explainFlag(record, flag);
          expectHebrew(he.x86Text.flagReason(key, params), `${example.id} ${flag}`);
        }
      }
    }
  });
});
