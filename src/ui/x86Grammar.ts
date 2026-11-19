import { hasMoreOperands, operandChoices, type OperandChoices } from '@/core/x86/builder';
import {
  CATEGORY_LABELS,
  MNEMONICS,
  REPEAT_PREFIXES,
  getSpec,
  isComplete,
  prefixAllows,
  type Instruction,
  type Mnemonic,
  type RepeatPrefix
} from '@/core/x86/instructions';
import { fitsIn, formatHex, type Size } from '@/core/shared/numbers';
import { formatLabel } from '@/core/shared/program';
import {
  MEMORY_BASES,
  formatImmediate,
  formatOperand,
  memorySegment,
  type MemoryBase,
  type Operand
} from '@/core/x86/operands';
import { isByteRegister, isSegmentRegister } from '@/core/x86/registers';
import type { BuilderOption, DraftContext, DraftToken, InstructionGrammar } from './builderGrammar';
import type { Messages } from './messages/en';

/** The instruction builder's state: what has been chosen so far, and what is being typed. */
export interface BuilderDraft {
  /** A repeat prefix chosen before the mnemonic; it narrows the mnemonics to the ones it fits. */
  prefix: RepeatPrefix | null;
  mnemonic: Mnemonic | null;
  operands: readonly Operand[];
  /** Set after choosing "byte [ ]" / "word [ ]", until the address inside the brackets is chosen. */
  pendingMemory: Size | null;
  /** The text in the filter as a number, or null when it is not one. */
  typed: number | null;
  /** The program, formatted, so jumps can offer its lines as targets. */
  programLines: readonly string[];
}

/** What choosing an option adds to the draft. */
export type OptionAction =
  | { kind: 'prefix'; prefix: RepeatPrefix }
  | { kind: 'mnemonic'; mnemonic: Mnemonic }
  | { kind: 'operand'; operand: Operand }
  /** Opens the brackets of a memory operand of this size. */
  | { kind: 'memory'; size: Size };

type X86Option = BuilderOption<OptionAction>;

const anyNumber = () => true;

function prefixOptions(m: Messages): X86Option[] {
  return (Object.keys(REPEAT_PREFIXES) as RepeatPrefix[]).map((prefix) => ({
    key: `prefix-${prefix}`,
    label: prefix,
    group: m.builderX86.repeatPrefix,
    hint: m.builderX86.prefixHint(REPEAT_PREFIXES[prefix]),
    action: { kind: 'prefix', prefix }
  }));
}

function mnemonicOptions(m: Messages, chosen: RepeatPrefix | null): X86Option[] {
  const options: X86Option[] = [];
  let prefixesOffered = chosen !== null;
  for (const mnemonic of MNEMONICS) {
    const { category, description } = getSpec(mnemonic);
    // The prefixes sit right after the string instructions they repeat.
    if (
      !prefixesOffered &&
      options.at(-1)?.group === CATEGORY_LABELS.string &&
      category !== 'string'
    ) {
      options.push(...prefixOptions(m));
      prefixesOffered = true;
    }
    if (chosen && !prefixAllows(chosen, mnemonic)) continue;
    options.push({
      key: mnemonic,
      label: mnemonic,
      group: CATEGORY_LABELS[category],
      hint: description,
      action: { kind: 'mnemonic', mnemonic }
    });
  }
  return options;
}

function memoryAddressOptions(m: Messages, size: Size, typed: number | null): X86Option[] {
  const operand = (base: MemoryBase | null, displacement: number): Operand => ({
    type: 'mem',
    size,
    base,
    displacement
  });
  const options: X86Option[] = MEMORY_BASES.map((base) => ({
    key: `base-${base}`,
    label: `[${base}]`,
    group: m.builderX86.addressInRegister,
    hint: `${memorySegment({ type: 'mem', size, base, displacement: 0 }).toUpperCase()}:${base.toUpperCase()}`,
    action: { kind: 'operand', operand: operand(base, 0) }
  }));

  if (typed !== null && typed >= 0 && typed <= 0xffff) {
    options.unshift({
      key: 'direct',
      label: `[0x${formatHex(typed, 16)}]`,
      group: m.builderX86.directAddress,
      hint: 'DS:offset',
      matchesNumber: anyNumber,
      action: { kind: 'operand', operand: operand(null, typed) }
    });
  }
  return options;
}

/** A typed number that fits the immediate, and the count of 1 that shifts take. */
function numberOptions(m: Messages, choices: OperandChoices, typed: number | null): X86Option[] {
  const options: X86Option[] = [];
  if (choices.immediate !== null && typed !== null && fitsIn(typed, choices.immediate)) {
    const size = choices.immediate;
    options.push({
      key: 'imm',
      label: formatImmediate(typed),
      group: m.builderX86.immediate(size),
      hint: typed < 0 ? `= 0x${formatHex(typed, size)}` : `= ${typed}`,
      matchesNumber: anyNumber,
      action: { kind: 'operand', operand: { type: 'imm', value: typed } }
    });
  }
  if (choices.one) {
    options.push({
      key: 'one',
      label: '1',
      group: m.builderX86.count,
      matchesNumber: (value) => value === 1,
      action: { kind: 'operand', operand: { type: 'imm', value: 1 } }
    });
  }
  return options;
}

/** Every program line as a target, plus the line after the last one (the end of the program). */
function lineOptions(
  m: Messages,
  mnemonic: Mnemonic,
  programLines: readonly string[]
): X86Option[] {
  const group =
    getSpec(mnemonic).category === 'control' ? m.builderCommon.jumpTo : m.builderX86.lineNumber;
  return Array.from({ length: programLines.length + 1 }, (_, target) => ({
    key: `label${target}`,
    label: formatLabel(target),
    group,
    hint: programLines[target] ?? m.builderCommon.endOfProgram,
    matchesNumber: (value: number) => value === target,
    action: { kind: 'operand', operand: { type: 'label', target } }
  }));
}

function registerOptions(m: Messages, registers: OperandChoices['registers']): X86Option[] {
  return registers.map((name) => ({
    key: name,
    label: name,
    group: isByteRegister(name)
      ? m.builderX86.byteRegisters
      : isSegmentRegister(name)
        ? m.builderX86.segmentRegisters
        : m.builderX86.wordRegisters,
    action: { kind: 'operand', operand: { type: 'reg', name } }
  }));
}

function memoryOptions(m: Messages, sizes: OperandChoices['memory']): X86Option[] {
  return sizes.map((size) => ({
    key: `mem${size}`,
    label: size === 8 ? 'byte [ ]' : 'word [ ]',
    group: m.builderX86.memory,
    hint: m.builderX86.memoryHint(size),
    action: { kind: 'memory', size }
  }));
}

function operandOptions(m: Messages, mnemonic: Mnemonic, draft: BuilderDraft): X86Option[] {
  const choices = operandChoices(mnemonic, draft.operands);
  return [
    ...numberOptions(m, choices, draft.typed),
    ...(choices.label ? lineOptions(m, mnemonic, draft.programLines) : []),
    ...registerOptions(m, choices.registers),
    ...memoryOptions(m, choices.memory)
  ];
}

/** The immediate size the typed number is too big for, or null when it fits or none is asked. */
export function overflowingSize(draft: BuilderDraft): Size | null {
  const { mnemonic, operands, pendingMemory, typed } = draft;
  if (mnemonic === null || pendingMemory !== null) return null;
  const size = operandChoices(mnemonic, operands).immediate;
  return size !== null && typed !== null && !fitsIn(typed, size) ? size : null;
}

/**
 * What the input says can be typed next. `filter` is the text as typed, quoted back when the
 * number does not fit; `complete` is whether the instruction can already run.
 */
export function typingHint(
  m: Messages,
  draft: BuilderDraft,
  filter: string,
  complete: boolean
): string {
  const { prefix, mnemonic, operands, pendingMemory } = draft;
  const x86 = m.builderX86;
  if (mnemonic === null) return prefix ? x86.pickString : m.builderCommon.filterInstructions;
  if (pendingMemory !== null) return x86.pickAddress;
  const tooBig = overflowingSize(draft);
  if (tooBig !== null) return x86.tooBig(filter, tooBig);
  const choices = operandChoices(mnemonic, operands);
  if (choices.immediate !== null) return x86.typeNumber;
  if (choices.label) return m.builderCommon.pickLine;
  return complete ? m.builderCommon.runOrAdd : m.builderCommon.filter;
}

/** Every choice the builder offers for the next word of the instruction. */
export function builderOptions(m: Messages, draft: BuilderDraft): X86Option[] {
  if (draft.mnemonic === null) return mnemonicOptions(m, draft.prefix);
  if (draft.pendingMemory !== null) {
    return memoryAddressOptions(m, draft.pendingMemory, draft.typed);
  }
  return operandOptions(m, draft.mnemonic, draft);
}

/** The words chosen so far, in the shape the 8086's options and hints are worked out from. */
function wordsOf(
  chosen: readonly OptionAction[],
  { typed, programLines }: Omit<DraftContext, 'messages'>
): BuilderDraft {
  const words: BuilderDraft = {
    prefix: null,
    mnemonic: null,
    operands: [],
    pendingMemory: null,
    typed,
    programLines
  };
  for (const action of chosen) {
    if (action.kind === 'prefix') words.prefix = action.prefix;
    if (action.kind === 'mnemonic') words.mnemonic = action.mnemonic;
    if (action.kind === 'memory') words.pendingMemory = action.size;
    if (action.kind === 'operand') {
      words.operands = [...words.operands, action.operand];
      words.pendingMemory = null;
    }
  }
  return words;
}

const NO_CONTEXT: Omit<DraftContext, 'messages'> = { typed: null, programLines: [] };

/** A memory operand is two choices, its size and then its address, but one word on screen. */
function tokensOf(chosen: readonly OptionAction[]): DraftToken[] {
  const tokens: DraftToken[] = [];
  let memory: { at: number; size: Size } | null = null;
  for (const [at, action] of chosen.entries()) {
    if (action.kind === 'prefix') tokens.push({ label: action.prefix, head: true, keep: at });
    if (action.kind === 'mnemonic') tokens.push({ label: action.mnemonic, head: true, keep: at });
    if (action.kind === 'memory') memory = { at, size: action.size };
    if (action.kind === 'operand') {
      tokens.push({ label: formatOperand(action.operand), keep: memory?.at ?? at });
      memory = null;
    }
  }
  if (memory) {
    const size = memory.size === 8 ? 'byte' : 'word';
    tokens.push({ label: `${size} [ ? ]`, pending: true, keep: memory.at });
  }
  return tokens;
}

function build(chosen: readonly OptionAction[]): Instruction[] | null {
  const { prefix, mnemonic, operands, pendingMemory } = wordsOf(chosen, NO_CONTEXT);
  if (mnemonic === null || pendingMemory !== null || !isComplete(mnemonic, operands)) return null;
  const instruction: Instruction = { mnemonic, operands: [...operands] };
  if (prefix) instruction.prefix = prefix;
  return [instruction];
}

/** How the builder builds 8086 instructions. */
export const X86_GRAMMAR: InstructionGrammar<OptionAction, Instruction> = {
  options: (chosen, context) => builderOptions(context.messages, wordsOf(chosen, context)),
  tokens: tokensOf,
  build,
  hasMore(chosen) {
    const { mnemonic, operands, pendingMemory } = wordsOf(chosen, NO_CONTEXT);
    return mnemonic === null || pendingMemory !== null || hasMoreOperands(mnemonic, operands);
  },
  overflows: (chosen, context) => overflowingSize(wordsOf(chosen, context)) !== null,
  hint: (chosen, context, filter, complete) =>
    typingHint(context.messages, wordsOf(chosen, context), filter, complete),
  describe(chosen) {
    const { mnemonic } = wordsOf(chosen, NO_CONTEXT);
    return mnemonic ? { label: mnemonic, text: getSpec(mnemonic).description } : null;
  }
};
