import { operandChoices, type OperandChoices } from '@/core/x86/builder';
import {
  CATEGORY_LABELS,
  MNEMONICS,
  REPEAT_PREFIXES,
  getSpec,
  prefixAllows,
  type Mnemonic,
  type RepeatPrefix
} from '@/core/x86/instructions';
import { fitsIn, formatHex, type Size } from '@/core/shared/numbers';
import {
  MEMORY_BASES,
  formatImmediate,
  formatLabel,
  memorySegment,
  type MemoryBase,
  type Operand
} from '@/core/x86/operands';
import { isByteRegister, isSegmentRegister } from '@/core/x86/registers';

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

export interface BuilderOption {
  key: string;
  label: string;
  group: string;
  hint?: string;
  /** For options a typed number can select: immediates, direct addresses, the count 1, labels. */
  matchesNumber?: (value: number) => boolean;
  action: OptionAction;
}

const anyNumber = () => true;

function prefixOptions(): BuilderOption[] {
  return (Object.keys(REPEAT_PREFIXES) as RepeatPrefix[]).map((prefix) => ({
    key: `prefix-${prefix}`,
    label: prefix,
    group: 'Repeat prefix',
    hint: `${REPEAT_PREFIXES[prefix]}. Pick the string instruction next.`,
    action: { kind: 'prefix', prefix }
  }));
}

function mnemonicOptions(chosen: RepeatPrefix | null): BuilderOption[] {
  const options: BuilderOption[] = [];
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

function memoryAddressOptions(size: Size, typed: number | null): BuilderOption[] {
  const operand = (base: MemoryBase | null, displacement: number): Operand => ({
    type: 'mem',
    size,
    base,
    displacement
  });
  const options: BuilderOption[] = MEMORY_BASES.map((base) => ({
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

/** A typed number that fits the immediate, and the count of 1 that shifts take. */
function numberOptions(choices: OperandChoices, typed: number | null): BuilderOption[] {
  const options: BuilderOption[] = [];
  if (choices.immediate !== null && typed !== null && fitsIn(typed, choices.immediate)) {
    const size = choices.immediate;
    options.push({
      key: 'imm',
      label: formatImmediate(typed),
      group: `Immediate (${size}-bit)`,
      hint: typed < 0 ? `= 0x${formatHex(typed, size)}` : `= ${typed}`,
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
function lineOptions(mnemonic: Mnemonic, programLines: readonly string[]): BuilderOption[] {
  const group =
    getSpec(mnemonic).category === 'control' ? 'Jump to program line' : 'Number of a program line';
  return Array.from({ length: programLines.length + 1 }, (_, target) => ({
    key: `label${target}`,
    label: formatLabel(target),
    group,
    hint: programLines[target] ?? 'end of program',
    matchesNumber: (value: number) => value === target,
    action: { kind: 'operand', operand: { type: 'label', target } }
  }));
}

function registerOptions(registers: OperandChoices['registers']): BuilderOption[] {
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

function memoryOptions(sizes: OperandChoices['memory']): BuilderOption[] {
  return sizes.map((size) => ({
    key: `mem${size}`,
    label: size === 8 ? 'byte [ ]' : 'word [ ]',
    group: 'Memory',
    hint: `${size}-bit value in memory`,
    action: { kind: 'memory', size }
  }));
}

function operandOptions(mnemonic: Mnemonic, draft: BuilderDraft): BuilderOption[] {
  const choices = operandChoices(mnemonic, draft.operands);
  return [
    ...numberOptions(choices, draft.typed),
    ...(choices.label ? lineOptions(mnemonic, draft.programLines) : []),
    ...registerOptions(choices.registers),
    ...memoryOptions(choices.memory)
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
export function builderOptions(draft: BuilderDraft): BuilderOption[] {
  if (draft.mnemonic === null) return mnemonicOptions(draft.prefix);
  if (draft.pendingMemory !== null) return memoryAddressOptions(draft.pendingMemory, draft.typed);
  return operandOptions(draft.mnemonic, draft);
}

/** The options the filter text leaves, in the order Enter should consider them. */
export function filterOptions(
  options: readonly BuilderOption[],
  filter: string,
  typed: number | null
): BuilderOption[] {
  const text = filter.trim().toLowerCase();
  if (!text) return [...options];
  // A typed number only selects the options that accept that number.
  if (typed !== null) return options.filter((option) => option.matchesNumber?.(typed));
  // Matches that start with the typed text come first, so Enter picks the obvious one.
  const matches = options.filter((option) => option.label.toLowerCase().includes(text));
  return [
    ...matches.filter((option) => option.label.toLowerCase().startsWith(text)),
    ...matches.filter((option) => !option.label.toLowerCase().startsWith(text))
  ];
}
