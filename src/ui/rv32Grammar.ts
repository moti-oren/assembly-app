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
import { ABI_NAMES, registerRole, type RegisterRole } from '@/core/rv32/registers';
import {
  END_OF_PROGRAM,
  type BuilderOption,
  type DraftContext,
  type DraftToken,
  type InstructionGrammar
} from './builderGrammar';

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

const IMMEDIATES: Partial<Record<PseudoKind, { label: string; fits: (value: number) => boolean }>> =
  {
    imm12: { label: '12-bit, -2048 to 2047', fits: (value) => fitsSigned(value, 12) },
    shamt: { label: 'shift amount, 0 to 31', fits: (value) => value >= 0 && value <= 31 },
    imm20: {
      label: 'upper 20 bits, 0 to 0xFFFFF',
      fits: (value) => value >= 0 && value <= 0xfffff
    },
    imm32: {
      label: 'any 32-bit value',
      fits: (value) => Number.isInteger(value) && value >= -(2 ** 31) && value < 2 ** 32
    },
    // A memory operand's offset is a 12-bit immediate too.
    mem: { label: '12-bit offset, -2048 to 2047', fits: (value) => fitsSigned(value, 12) }
  };

const ROLE_GROUPS: Record<RegisterRole, string> = {
  special: 'Special: zero, return address, stack, global and thread pointers',
  argument: 'Arguments and return values (a0–a7)',
  temporary: 'Temporaries (t0–t6)',
  saved: 'Saved across calls (s0–s11)'
};

const anyNumber = () => true;

function mnemonicOptions(): Option[] {
  const real: Option[] = MNEMONICS.map((mnemonic) => {
    const { category, format, description } = getSpec(mnemonic);
    return {
      key: mnemonic,
      label: mnemonic,
      group: CATEGORY_LABELS[category],
      hint: `${description} (${format}-type)`,
      action: { kind: 'mnemonic', mnemonic }
    };
  });
  const pseudo: Option[] = PSEUDO_MNEMONICS.map((mnemonic) => ({
    key: `pseudo-${mnemonic}`,
    label: mnemonic,
    group: 'Pseudo-instructions: the assembler turns each into real ones',
    hint: pseudoSpec(mnemonic).description,
    action: { kind: 'pseudo', mnemonic }
  }));
  return [...real, ...pseudo];
}

function registerOptions(
  label: (abi: string) => string,
  operand: (index: number) => Operand
): Option[] {
  return ABI_NAMES.map((abi, index) => ({
    key: `x${index}`,
    label: label(abi),
    group: ROLE_GROUPS[registerRole(index)],
    hint: index === 0 ? 'x0: always reads as 0; writes to it are thrown away' : `x${index}`,
    action: { kind: 'operand', operand: operand(index) }
  }));
}

function lineOptions(words: Words, programLines: readonly string[]): Option[] {
  return Array.from({ length: programLines.length + 1 }, (_, target) => ({
    key: `label${target}`,
    label: formatLabel(target),
    group:
      words.mnemonic === 'jal' || words.pseudo === 'j'
        ? 'Jump to program line'
        : 'Branch to program line',
    hint: programLines[target] ?? END_OF_PROGRAM,
    matchesNumber: (value: number) => value === target,
    action: { kind: 'operand', operand: { type: 'label', target } }
  }));
}

/** `offset(base)`: a typed offset first, or straight to the base register with offset 0. */
function memoryOptions(pendingOffset: number | null, typed: number | null): Option[] {
  if (pendingOffset !== null) {
    return registerOptions(
      (abi) => `${pendingOffset}(${abi})`,
      (base) => ({ type: 'mem', base, offset: pendingOffset })
    );
  }
  const options = registerOptions(
    (abi) => `0(${abi})`,
    (base) => ({ type: 'mem', base, offset: 0 })
  );
  if (typed !== null && fitsSigned(typed, 12)) {
    options.unshift({
      key: 'offset',
      label: `${typed}( )`,
      group: 'Offset from a base register',
      hint: 'Then pick the register the offset is added to',
      matchesNumber: anyNumber,
      action: { kind: 'offset', offset: typed }
    });
  }
  return options;
}

function immediateOption(kind: PseudoKind, typed: number | null): Option[] {
  const immediate = IMMEDIATES[kind];
  if (!immediate || typed === null || !immediate.fits(typed)) return [];
  const value = { type: 'imm', value: typed } as const;
  return [
    {
      key: 'imm',
      label: formatOperand(value),
      group: `Immediate (${immediate.label})`,
      hint: typed < 0 ? `= 0x${(typed >>> 0).toString(16).toUpperCase()}` : `= ${typed}`,
      matchesNumber: anyNumber,
      action: { kind: 'operand', operand: value }
    }
  ];
}

function options(chosen: readonly Rv32Action[], context: DraftContext): Option[] {
  const words = wordsOf(chosen);
  if (words.mnemonic === null && words.pseudo === null) return mnemonicOptions();
  const kind = nextKind(words);
  if (kind === 'reg')
    return registerOptions(
      (abi) => abi,
      (index) => ({ type: 'reg', index })
    );
  if (kind === 'mem') return memoryOptions(words.pendingOffset, context.typed);
  if (kind === 'label') return lineOptions(words, context.programLines);
  return kind ? immediateOption(kind, context.typed) : [];
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

function parse({ mnemonic, operands }: Instruction): Rv32Action[] {
  return [
    { kind: 'mnemonic', mnemonic },
    ...operands.map((operand) => ({ kind: 'operand', operand }) as const)
  ];
}

function overflows(chosen: readonly Rv32Action[], context: DraftContext): boolean {
  const words = wordsOf(chosen);
  const kind = nextKind(words);
  const immediate = kind && words.pendingOffset === null ? IMMEDIATES[kind] : undefined;
  return immediate !== undefined && context.typed !== null && !immediate.fits(context.typed);
}

/** How the builder builds RISC-V instructions, pseudo-instructions included. */
export const RV32_GRAMMAR: InstructionGrammar<Rv32Action, Instruction> = {
  options,
  tokens,
  build,
  parse,
  hasMore(chosen) {
    const words = wordsOf(chosen);
    const form = formOf(words);
    return form === null || words.pendingOffset !== null || words.operands.length < form.length;
  },
  overflows,
  hint(chosen, context, filter, complete) {
    const words = wordsOf(chosen);
    if (words.mnemonic === null && words.pseudo === null) return 'Type to filter instructions';
    if (words.pendingOffset !== null) return 'Pick the base register the offset is added to';
    const kind = nextKind(words);
    if (overflows(chosen, context) && kind) {
      return `${filter} does not fit: ${IMMEDIATES[kind]!.label}`;
    }
    if (kind === 'mem') return 'Type an offset (e.g. 8 or -4), or pick the base register';
    if (kind === 'label') return 'Pick a line to jump to, or type its number';
    if (kind === 'reg') return 'Pick a register, or type its name (a0, t1, sp…)';
    if (kind) return 'Type a number: 42 (decimal), -5, 0x2A or 101010b';
    return complete ? 'Enter: run now · Shift+Enter: add to the program' : 'Type to filter';
  },
  describe(chosen) {
    const { mnemonic, pseudo } = wordsOf(chosen);
    if (mnemonic) {
      const { description, format } = getSpec(mnemonic);
      return { label: mnemonic, text: `${description} (${format}-type)` };
    }
    if (!pseudo) return null;
    const expanded = build(chosen);
    const text = expanded
      ? `becomes ${expanded.map(formatInstruction).join(', then ')}`
      : pseudoSpec(pseudo).description;
    return { label: pseudo, text };
  }
};
