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
import {
  END_OF_PROGRAM,
  type BuilderOption,
  type DraftContext,
  type DraftToken,
  type InstructionGrammar
} from './builderGrammar';

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

function prefixOptions(): X86Option[] {
  return (Object.keys(REPEAT_PREFIXES) as RepeatPrefix[]).map((prefix) => ({
    key: `prefix-${prefix}`,
    label: prefix,
    group: 'Repeat prefix',
    hint: `${REPEAT_PREFIXES[prefix]}. Pick the string instruction next.`,
    action: { kind: 'prefix', prefix }
  }));
}

function mnemonicOptions(chosen: RepeatPrefix | null): X86Option[] {
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
      options.push(...prefixOptions());
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

function memoryAddressOptions(size: Size, typed: number | null): X86Option[] {
  const operand = (base: MemoryBase | null, displacement: number): Operand => ({
    type: 'mem',
    size,
    base,
    displacement
  });
  const options: X86Option[] = MEMORY_BASES.map((base) => ({
    key: `base-${base}`,
    label: `[${base}]`,
    group: 'Address in a register',
    hint: `${memorySegment({ type: 'mem', size, base, displacement: 0 }).toUpperCase()}:${base.toUpperCase()}`,
    action: { kind: 'operand', operand: operand(base, 0) }
  }));

  if (typed !== null && typed >= 0 && typed <= 0xffff) {
    options.unshift({
      key: 'direct',
      label: `[0x${formatHex(typed, 16)}]`,
      group: 'Direct address',
      hint: 'DS:offset',
      matchesNumber: anyNumber,
      action: { kind: 'operand', operand: operand(null, typed) }
    });
  }
  return options;
}

/** The number in the base its label does not use: the label of 5 is `5`, of 65 it is `0x41`. */
function otherBase(value: number, size: Size): string {
  return formatImmediate(value).startsWith('0x') ? String(value) : `${formatHex(value, size)}h`;
}

/** A typed number that fits the immediate, and the count of 1 that shifts take. */
function numberOptions(choices: OperandChoices, typed: number | null): X86Option[] {
  const options: X86Option[] = [];
  if (choices.immediate !== null && typed !== null && fitsIn(typed, choices.immediate)) {
    const size = choices.immediate;
    options.push({
      key: 'imm',
      label: formatImmediate(typed),
      group: `Immediate (${size}-bit)`,
      hint: `= ${otherBase(typed, size)}, ${size}-bit immediate`,
      matchesNumber: anyNumber,
      action: { kind: 'operand', operand: { type: 'imm', value: typed } }
    });
  }
  if (choices.one) {
    options.push({
      key: 'one',
      label: '1',
      group: 'Count',
      matchesNumber: (value) => value === 1,
      action: { kind: 'operand', operand: { type: 'imm', value: 1 } }
    });
  }
  return options;
}

/** Every program line as a target, plus the line after the last one (the end of the program). */
function lineOptions(mnemonic: Mnemonic, programLines: readonly string[]): X86Option[] {
  const group =
    getSpec(mnemonic).category === 'control' ? 'Jump to program line' : 'Number of a program line';
  return Array.from({ length: programLines.length + 1 }, (_, target) => ({
    key: `label${target}`,
    label: formatLabel(target),
    group,
    hint: programLines[target] ?? END_OF_PROGRAM,
    matchesNumber: (value: number) => value === target,
    action: { kind: 'operand', operand: { type: 'label', target } }
  }));
}

function registerOptions(registers: OperandChoices['registers']): X86Option[] {
  return registers.map((name) => ({
    key: name,
    label: name,
    group: isByteRegister(name)
      ? '8-bit registers'
      : isSegmentRegister(name)
        ? 'Segment registers'
        : '16-bit registers',
    action: { kind: 'operand', operand: { type: 'reg', name } }
  }));
}

function memoryOptions(sizes: OperandChoices['memory']): X86Option[] {
  return sizes.map((size) => ({
    key: `mem${size}`,
    label: size === 8 ? 'byte [ ]' : 'word [ ]',
    group: 'Memory',
    hint: `${size}-bit value in memory`,
    action: { kind: 'memory', size }
  }));
}

function operandOptions(mnemonic: Mnemonic, draft: BuilderDraft): X86Option[] {
  const choices = operandChoices(mnemonic, draft.operands);
  const lines = choices.label ? lineOptions(mnemonic, draft.programLines) : [];
  // A jump's operand is a line; MOV's can be one too, but a register is what it usually wants,
  // so there the lines come last and Enter does not pick L0.
  const linesFirst = choices.registers.length === 0;
  return [
    ...numberOptions(choices, draft.typed),
    ...(linesFirst ? lines : []),
    ...registerOptions(choices.registers),
    ...memoryOptions(choices.memory),
    ...(linesFirst ? [] : lines)
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
export function typingHint(draft: BuilderDraft, filter: string, complete: boolean): string {
  const { prefix, mnemonic, operands, pendingMemory } = draft;
  if (mnemonic === null) {
    return prefix ? 'Pick the string instruction to repeat' : 'Type to filter instructions';
  }
  if (pendingMemory !== null) return 'Pick a register or type an offset (e.g. 0x10)';
  const tooBig = overflowingSize(draft);
  if (tooBig !== null) return `${filter} does not fit in ${tooBig} bits`;
  const choices = operandChoices(mnemonic, operands);
  if (choices.immediate !== null) {
    return 'Type a number: 42 (decimal), 0x2A or 2Ah (hex), 101010b (binary)';
  }
  if (choices.label) return 'Pick a line to jump to, or type its number';
  if (complete) return 'Enter: run now · Shift+Enter: add to the program';
  return 'Type to filter';
}

/** Every choice the builder offers for the next word of the instruction. */
export function builderOptions(draft: BuilderDraft): X86Option[] {
  if (draft.mnemonic === null) return mnemonicOptions(draft.prefix);
  if (draft.pendingMemory !== null) return memoryAddressOptions(draft.pendingMemory, draft.typed);
  return operandOptions(draft.mnemonic, draft);
}

/** The words chosen so far, in the shape the 8086's options and hints are worked out from. */
function wordsOf(chosen: readonly OptionAction[], context: DraftContext): BuilderDraft {
  const words: BuilderDraft = {
    prefix: null,
    mnemonic: null,
    operands: [],
    pendingMemory: null,
    ...context
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

const NO_CONTEXT: DraftContext = { typed: null, programLines: [] };

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

function parse({ prefix, mnemonic, operands }: Instruction): OptionAction[] {
  return [
    ...(prefix ? [{ kind: 'prefix', prefix } as const] : []),
    { kind: 'mnemonic', mnemonic },
    ...operands.map((operand) => ({ kind: 'operand', operand }) as const)
  ];
}

/** How the builder builds 8086 instructions. */
export const X86_GRAMMAR: InstructionGrammar<OptionAction, Instruction> = {
  options: (chosen, context) => builderOptions(wordsOf(chosen, context)),
  tokens: tokensOf,
  build,
  parse,
  hasMore(chosen) {
    const { mnemonic, operands, pendingMemory } = wordsOf(chosen, NO_CONTEXT);
    return mnemonic === null || pendingMemory !== null || hasMoreOperands(mnemonic, operands);
  },
  overflows: (chosen, context) => overflowingSize(wordsOf(chosen, context)) !== null,
  hint: (chosen, context, filter, complete) =>
    typingHint(wordsOf(chosen, context), filter, complete),
  describe(chosen) {
    const { mnemonic } = wordsOf(chosen, NO_CONTEXT);
    return mnemonic ? { label: mnemonic, text: getSpec(mnemonic).description } : null;
  }
};
