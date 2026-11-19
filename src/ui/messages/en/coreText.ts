import type { Widen } from '../widen';
import { OPERAND_KIND_LABELS } from '@/core/x86/decode';
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
    register: (register: WordRegister) => REGISTER_DESCRIPTIONS[register]
  },
  rv32Text: {
    category: (category: Rv32Category) => RV32_CATEGORIES[category],
    description: (mnemonic: Rv32Mnemonic) => rv32Spec(mnemonic).description,
    pseudo: (mnemonic: PseudoMnemonic) => pseudoSpec(mnemonic).description
  },
  mos6502Text: {
    category: (category: Mos6502Category) => MOS6502_CATEGORIES[category],
    description: (mnemonic: Mos6502Mnemonic) => mos6502Spec(mnemonic).description
  }
};

export type CoreTextMessages = Widen<typeof coreText>;
