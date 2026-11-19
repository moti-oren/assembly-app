import type { Widen } from '../widen';
import { COMPARISON_TASKS } from '@/core/comparisonTasks';
import { MOS6502 } from '@/core/mos6502/architecture';
import { RV32 } from '@/core/rv32/architecture';
import { X86 } from '@/core/x86/architecture';
import type { ArchitectureId } from '../../architectures';
import { fillText, type TextParams } from '@/core/shared/text';
import { OPERAND_KIND_LABELS } from '@/core/x86/decode';
import { FLAG_REASON_TEXTS, type FlagReasonKey } from '@/core/x86/flagReasonTexts';
import { FLAG_INFO, type FlagName } from '@/core/x86/flags';
import {
  CATEGORY_LABELS as X86_CATEGORIES,
  REPEAT_PREFIXES,
  getSpec as x86Spec,
  type Category as X86Category,
  type Mnemonic as X86Mnemonic,
  type RepeatPrefix
} from '@/core/x86/instructions';
import type { OperandKind } from '@/core/x86/operands';
import { REGISTER_DESCRIPTIONS, type WordRegister } from '@/core/x86/registers';
import {
  CATEGORY_LABELS as RV32_CATEGORIES,
  getSpec as rv32Spec,
  type Category as Rv32Category,
  type Mnemonic as Rv32Mnemonic
} from '@/core/rv32/instructions';
import { pseudoSpec, type PseudoMnemonic } from '@/core/rv32/pseudo';
import {
  CATEGORY_LABELS as MOS6502_CATEGORIES,
  getSpec as mos6502Spec,
  type Category as Mos6502Category,
  type Mnemonic as Mos6502Mnemonic
} from '@/core/mos6502/instructions';

const EXAMPLES = { x86: X86.examples, rv32: RV32.examples, mos6502: MOS6502.examples };

function exampleOf(architecture: ArchitectureId, id: string) {
  const found = EXAMPLES[architecture].find((example) => example.id === id);
  if (!found) throw new Error(`No ${architecture} example with the id ${id}`);
  return found;
}

function taskOf(id: string) {
  const found = COMPARISON_TASKS.find((task) => task.id === id);
  if (!found) throw new Error(`No comparison task with the id ${id}`);
  return found;
}

/**
 * What the instruction sets and the CPU's parts are called and described. In English these are
 * read straight from the core, which writes them in English; Hebrew has a table of its own for
 * each, typed by the same keys, so a mnemonic or flag missing from it is a type error.
 */
export const coreText = {
  x86Text: {
    category: (category: X86Category) => X86_CATEGORIES[category],
    description: (mnemonic: X86Mnemonic, prefix?: RepeatPrefix | null) =>
      prefix
        ? `${REPEAT_PREFIXES[prefix]}: ${x86Spec(mnemonic).description}`
        : x86Spec(mnemonic).description,
    prefix: (prefix: RepeatPrefix) => REPEAT_PREFIXES[prefix],
    operandKind: (kind: OperandKind) => OPERAND_KIND_LABELS[kind],
    flagLabel: (flag: FlagName) => FLAG_INFO[flag].label,
    flagDescription: (flag: FlagName) => FLAG_INFO[flag].description,
    register: (register: WordRegister) => REGISTER_DESCRIPTIONS[register],
    flagReason: (key: FlagReasonKey, params: TextParams) => fillText(FLAG_REASON_TEXTS[key], params)
  },
  rv32Text: {
    category: (category: Rv32Category) => RV32_CATEGORIES[category],
    description: (mnemonic: Rv32Mnemonic) => rv32Spec(mnemonic).description,
    pseudo: (mnemonic: PseudoMnemonic) => pseudoSpec(mnemonic).description
  },
  mos6502Text: {
    category: (category: Mos6502Category) => MOS6502_CATEGORIES[category],
    description: (mnemonic: Mos6502Mnemonic) => mos6502Spec(mnemonic).description
  },
  /** The example programs and the comparison tasks, by the id each one has in the core. */
  examples: {
    name: (architecture: ArchitectureId, id: string) => exampleOf(architecture, id).name,
    description: (architecture: ArchitectureId, id: string) =>
      exampleOf(architecture, id).description
  },
  tasks: {
    name: (id: string) => taskOf(id).name,
    lesson: (id: string) => taskOf(id).lesson
  }
};

export type CoreTextMessages = Widen<typeof coreText>;
