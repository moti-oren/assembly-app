import { formatLabel } from '@/core/shared/program';
import { fitsSigned } from '@/core/rv32/bits';
import {
  CATEGORY_LABELS,
  MNEMONICS,
  formatInstruction,
  getSpec,
  isValid,
  type Instruction,
  type Mnemonic
} from '@/core/rv32/instructions';
import { formatOperand, type Operand } from '@/core/rv32/operands';
import {
  PSEUDO_MNEMONICS,
  expandPseudo,
  isValidPseudo,
  pseudoSpec,
  type PseudoKind,
  type PseudoMnemonic
} from '@/core/rv32/pseudo';
import { ABI_NAMES, registerRole } from '@/core/rv32/registers';
import type { BuilderOption, DraftContext, DraftToken, InstructionGrammar } from './builderGrammar';
import type { Messages } from './messages/en';

/** What choosing an option adds to a RISC-V instruction. */
export type Rv32Action =
  | { kind: 'mnemonic'; mnemonic: Mnemonic }
  | { kind: 'pseudo'; mnemonic: PseudoMnemonic }
  | { kind: 'operand'; operand: Operand }
  /** A typed offset, which opens `offset( )` until its base register is chosen. */
  | { kind: 'offset'; offset: number };

type Option = BuilderOption<Rv32Action>;

/** The words chosen so far. */
interface Words {
  mnemonic: Mnemonic | null;
  pseudo: PseudoMnemonic | null;
  operands: Operand[];
  pendingOffset: number | null;
}

function wordsOf(chosen: readonly Rv32Action[]): Words {
  const words: Words = { mnemonic: null, pseudo: null, operands: [], pendingOffset: null };
  for (const action of chosen) {
    if (action.kind === 'mnemonic') words.mnemonic = action.mnemonic;
    if (action.kind === 'pseudo') words.pseudo = action.mnemonic;
    if (action.kind === 'offset') words.pendingOffset = action.offset;
    if (action.kind === 'operand') {
      words.operands = [...words.operands, action.operand];
      words.pendingOffset = null;
    }
  }
  return words;
}

function formOf({ mnemonic, pseudo }: Words): readonly PseudoKind[] | null {
  if (mnemonic) return getSpec(mnemonic).form;
  return pseudo ? pseudoSpec(pseudo).form : null;
}

/** The kind of the next operand, or null when there is none. */
function nextKind(words: Words): PseudoKind | null {
  return formOf(words)?.[words.operands.length] ?? null;
}

/** The operand kinds that take a number, and the numbers each one takes. */
type ImmediateKind = keyof Messages['builderRv32']['immediates'];

const IMMEDIATES: Record<ImmediateKind, (value: number) => boolean> = {
  imm12: (value) => fitsSigned(value, 12),
  shamt: (value) => value >= 0 && value <= 31,
  imm20: (value) => value >= 0 && value <= 0xfffff,
  imm32: (value) => Number.isInteger(value) && value >= -(2 ** 31) && value < 2 ** 32,
  // A memory operand's offset is a 12-bit immediate too.
  mem: (value) => fitsSigned(value, 12)
};

function isImmediate(kind: PseudoKind | null): kind is ImmediateKind {
  return kind !== null && kind in IMMEDIATES;
}

const anyNumber = () => true;

function mnemonicOptions(m: Messages): Option[] {
  const real: Option[] = MNEMONICS.map((mnemonic) => {
    const { category, format, description } = getSpec(mnemonic);
    return {
      key: mnemonic,
      label: mnemonic,
      group: CATEGORY_LABELS[category],
      hint: m.builderRv32.withFormat(description, format),
      action: { kind: 'mnemonic', mnemonic }
    };
  });
  const pseudo: Option[] = PSEUDO_MNEMONICS.map((mnemonic) => ({
    key: `pseudo-${mnemonic}`,
    label: mnemonic,
    group: m.builderRv32.pseudo,
    hint: pseudoSpec(mnemonic).description,
    action: { kind: 'pseudo', mnemonic }
  }));
  return [...real, ...pseudo];
}

function registerOptions(
  m: Messages,
  label: (abi: string) => string,
  operand: (index: number) => Operand
): Option[] {
  return ABI_NAMES.map((abi, index) => ({
    key: `x${index}`,
    label: label(abi),
    group: m.builderRv32.roles[registerRole(index)],
    hint: index === 0 ? m.builderRv32.zero : `x${index}`,
    action: { kind: 'operand', operand: operand(index) }
  }));
}

function lineOptions(m: Messages, words: Words, programLines: readonly string[]): Option[] {
  return Array.from({ length: programLines.length + 1 }, (_, target) => ({
    key: `label${target}`,
    label: formatLabel(target),
    group:
      words.mnemonic === 'jal' || words.pseudo === 'j'
        ? m.builderCommon.jumpTo
        : m.builderCommon.branchTo,
    hint: programLines[target] ?? m.builderCommon.endOfProgram,
    matchesNumber: (value: number) => value === target,
    action: { kind: 'operand', operand: { type: 'label', target } }
  }));
}

/** `offset(base)`: a typed offset first, or straight to the base register with offset 0. */
function memoryOptions(m: Messages, pendingOffset: number | null, typed: number | null): Option[] {
  if (pendingOffset !== null) {
    return registerOptions(
      m,
      (abi) => `${pendingOffset}(${abi})`,
      (base) => ({ type: 'mem', base, offset: pendingOffset })
    );
  }
  const options = registerOptions(
    m,
    (abi) => `0(${abi})`,
    (base) => ({ type: 'mem', base, offset: 0 })
  );
  if (typed !== null && fitsSigned(typed, 12)) {
    options.unshift({
      key: 'offset',
      label: `${typed}( )`,
      group: m.builderRv32.offset,
      hint: m.builderRv32.offsetHint,
      matchesNumber: anyNumber,
      action: { kind: 'offset', offset: typed }
    });
  }
  return options;
}

function immediateOption(m: Messages, kind: PseudoKind, typed: number | null): Option[] {
  if (!isImmediate(kind) || typed === null || !IMMEDIATES[kind](typed)) return [];
  const value = { type: 'imm', value: typed } as const;
  return [
    {
      key: 'imm',
      label: formatOperand(value),
      group: m.builderRv32.immediate(m.builderRv32.immediates[kind]),
      hint: typed < 0 ? `= 0x${(typed >>> 0).toString(16).toUpperCase()}` : `= ${typed}`,
      matchesNumber: anyNumber,
      action: { kind: 'operand', operand: value }
    }
  ];
}

function options(chosen: readonly Rv32Action[], context: DraftContext): Option[] {
  const m = context.messages;
  const words = wordsOf(chosen);
  if (words.mnemonic === null && words.pseudo === null) return mnemonicOptions(m);
  const kind = nextKind(words);
  if (kind === 'reg')
    return registerOptions(
      m,
      (abi) => abi,
      (index) => ({ type: 'reg', index })
    );
  if (kind === 'mem') return memoryOptions(m, words.pendingOffset, context.typed);
  if (kind === 'label') return lineOptions(m, words, context.programLines);
  return kind ? immediateOption(m, kind, context.typed) : [];
}

function tokens(chosen: readonly Rv32Action[]): DraftToken[] {
  const list: DraftToken[] = [];
  let offset: { at: number; value: number } | null = null;
  for (const [at, action] of chosen.entries()) {
    if (action.kind === 'mnemonic' || action.kind === 'pseudo') {
      list.push({ label: action.mnemonic, head: true, keep: at });
    }
    if (action.kind === 'offset') offset = { at, value: action.offset };
    if (action.kind === 'operand') {
      list.push({ label: formatOperand(action.operand), keep: offset?.at ?? at });
      offset = null;
    }
  }
  if (offset) list.push({ label: `${offset.value}( ? )`, pending: true, keep: offset.at });
  return list;
}

function build(chosen: readonly Rv32Action[]): Instruction[] | null {
  const { mnemonic, pseudo, operands, pendingOffset } = wordsOf(chosen);
  if (pendingOffset !== null) return null;
  if (mnemonic) {
    const instruction = { mnemonic, operands };
    return isValid(instruction) ? [instruction] : null;
  }
  if (pseudo) {
    const instruction = { mnemonic: pseudo, operands };
    return isValidPseudo(instruction) ? expandPseudo(instruction) : null;
  }
  return null;
}

function overflows(chosen: readonly Rv32Action[], context: DraftContext): boolean {
  const words = wordsOf(chosen);
  const kind = nextKind(words);
  if (!isImmediate(kind) || words.pendingOffset !== null || context.typed === null) return false;
  return !IMMEDIATES[kind](context.typed);
}

/** How the builder builds RISC-V instructions, pseudo-instructions included. */
export const RV32_GRAMMAR: InstructionGrammar<Rv32Action, Instruction> = {
  options,
  tokens,
  build,
  hasMore(chosen) {
    const words = wordsOf(chosen);
    const form = formOf(words);
    return form === null || words.pendingOffset !== null || words.operands.length < form.length;
  },
  overflows,
  hint(chosen, context, filter, complete) {
    const { builderRv32: rv32, builderCommon: common } = context.messages;
    const words = wordsOf(chosen);
    if (words.mnemonic === null && words.pseudo === null) return common.filterInstructions;
    if (words.pendingOffset !== null) return rv32.pickBase;
    const kind = nextKind(words);
    if (overflows(chosen, context) && isImmediate(kind)) {
      return rv32.tooBig(filter, rv32.immediates[kind]);
    }
    if (kind === 'mem') return rv32.typeOffset;
    if (kind === 'label') return common.pickLine;
    if (kind === 'reg') return rv32.pickRegister;
    if (kind) return rv32.typeNumber;
    return complete ? common.runOrAdd : common.filter;
  },
  describe(chosen, m) {
    const { mnemonic, pseudo } = wordsOf(chosen);
    if (mnemonic) {
      const { description, format } = getSpec(mnemonic);
      return { label: mnemonic, text: m.builderRv32.withFormat(description, format) };
    }
    if (!pseudo) return null;
    const expanded = build(chosen);
    const text = expanded
      ? m.builderRv32.becomes(expanded.map((line) => m.common.code(formatInstruction(line))))
      : pseudoSpec(pseudo).description;
    return { label: pseudo, text };
  }
};
