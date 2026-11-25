import { formatLabel } from '@/core/shared/program';
import {
  CATEGORY_LABELS,
  MNEMONICS,
  getSpec,
  isBranch,
  isValid,
  modeOfInstruction,
  opcodeOf,
  type Instruction,
  type Mnemonic,
  type Opcode
} from '@/core/mos6502/instructions';
import { formatOperand, hex, MODE_NAMES, type Mode, type Operand } from '@/core/mos6502/operands';
import {
  END_OF_PROGRAM,
  type BuilderOption,
  type DraftContext,
  type DraftToken,
  type InstructionGrammar
} from './builderGrammar';

/** What choosing an option adds to a 6502 instruction: the mnemonic, then at most one operand. */
export type Mos6502Action =
  { kind: 'mnemonic'; mnemonic: Mnemonic } | { kind: 'operand'; operand: Operand };

type Option = BuilderOption<Mos6502Action>;

interface Words {
  mnemonic: Mnemonic | null;
  operand: Operand | null;
}

function wordsOf(chosen: readonly Mos6502Action[]): Words {
  const words: Words = { mnemonic: null, operand: null };
  for (const action of chosen) {
    if (action.kind === 'mnemonic') words.mnemonic = action.mnemonic;
    else words.operand = action.operand;
  }
  return words;
}

function modesOf(mnemonic: Mnemonic): Mode[] {
  return Object.keys(getSpec(mnemonic).modes) as Mode[];
}

function cycles({ cycles: count, pageCross }: Opcode): string {
  return `${count} cycles${pageCross ? ', +1 across a page' : ''}`;
}

const byte = (value: number) => Number.isInteger(value) && value >= 0 && value <= 0xff;
const word = (value: number) => Number.isInteger(value) && value >= 0 && value <= 0xffff;

/** Each mode a typed number can be, in the order they are offered, with what it means. */
const NUMBER_MODES: {
  mode: Mode;
  fits: (value: number) => boolean;
  operand: (value: number) => Operand;
  meaning: (value: number) => string;
}[] = [
  {
    mode: 'imm',
    fits: (v) => Number.isInteger(v) && v >= -128 && v <= 0xff,
    operand: (v) => ({ type: 'imm', value: v }),
    meaning: (v) => `the value $${hex(v & 0xff, 2)} itself`
  },
  {
    mode: 'zp',
    fits: byte,
    operand: (v) => ({ type: 'zp', address: v, index: null }),
    meaning: (v) => `the byte at $${hex(v, 4)}, in the zero page: one byte shorter than absolute`
  },
  {
    mode: 'zpx',
    fits: byte,
    operand: (v) => ({ type: 'zp', address: v, index: 'x' }),
    meaning: (v) => `the byte at $${hex(v, 2)} + X, wrapping around in the zero page`
  },
  {
    mode: 'zpy',
    fits: byte,
    operand: (v) => ({ type: 'zp', address: v, index: 'y' }),
    meaning: (v) => `the byte at $${hex(v, 2)} + Y, wrapping around in the zero page`
  },
  {
    mode: 'abs',
    fits: word,
    operand: (v) => ({ type: 'abs', address: v, index: null }),
    meaning: (v) => `the byte at $${hex(v, 4)}`
  },
  {
    mode: 'abx',
    fits: word,
    operand: (v) => ({ type: 'abs', address: v, index: 'x' }),
    meaning: (v) => `the byte at $${hex(v, 4)} + X`
  },
  {
    mode: 'aby',
    fits: word,
    operand: (v) => ({ type: 'abs', address: v, index: 'y' }),
    meaning: (v) => `the byte at $${hex(v, 4)} + Y`
  },
  {
    mode: 'ind',
    fits: word,
    operand: (v) => ({ type: 'ind', address: v }),
    meaning: (v) => `jump to the address stored at $${hex(v, 4)}`
  },
  {
    mode: 'izx',
    fits: byte,
    operand: (v) => ({ type: 'izx', address: v }),
    meaning: (v) => `the byte at the address stored at $${hex(v, 2)} + X in the zero page`
  },
  {
    mode: 'izy',
    fits: byte,
    operand: (v) => ({ type: 'izy', address: v }),
    meaning: (v) => `the byte at the address stored at $${hex(v, 2)}, plus Y`
  }
];

/** JMP and JSR take a program line, not a number: the line's address is worked out for them. */
const takesLine = (mnemonic: Mnemonic) =>
  isBranch(mnemonic) || mnemonic === 'jsr' || mnemonic === 'jmp';

function mnemonicOptions(): Option[] {
  return MNEMONICS.map((mnemonic) => {
    const { category, description } = getSpec(mnemonic);
    return {
      key: mnemonic,
      label: mnemonic,
      group: CATEGORY_LABELS[category],
      hint: description,
      action: { kind: 'mnemonic', mnemonic }
    };
  });
}

function numberOptions(mnemonic: Mnemonic, typed: number): Option[] {
  const { modes } = getSpec(mnemonic);
  // JMP's absolute mode is its line: a number there could land between two lines.
  const offered = (mode: Mode) => modes[mode] && !(mode === 'abs' && takesLine(mnemonic));
  // A number is never JMP's target itself, only where it reads one: say so beside it.
  const through = mnemonic === 'jmp' ? '. To jump to a line, pick one of L0, L1, … instead' : '';
  return NUMBER_MODES.filter(({ mode, fits }) => offered(mode) && fits(typed)).map(
    ({ mode, operand, meaning }) => {
      const chosen = operand(typed);
      return {
        key: mode,
        label: formatOperand(chosen),
        group: `${MODE_NAMES[mode][0].toUpperCase()}${MODE_NAMES[mode].slice(1)}`,
        // The cycles first: a long meaning is what gets cut on a narrow line, not the count.
        hint: `${cycles(modes[mode]!)} · ${meaning(typed)}${through}`,
        matchesNumber: () => true,
        action: { kind: 'operand', operand: chosen }
      };
    }
  );
}

function lineOptions(mnemonic: Mnemonic, programLines: readonly string[]): Option[] {
  return Array.from({ length: programLines.length + 1 }, (_, target) => ({
    key: `label${target}`,
    label: formatLabel(target),
    group: isBranch(mnemonic) ? 'Branch to program line' : 'Jump to program line',
    hint: programLines[target] ?? END_OF_PROGRAM,
    matchesNumber: (value: number) => value === target,
    action: { kind: 'operand', operand: { type: 'label', target } }
  }));
}

function options(chosen: readonly Mos6502Action[], context: DraftContext): Option[] {
  const { mnemonic, operand } = wordsOf(chosen);
  if (mnemonic === null) return mnemonicOptions();
  if (operand) return [];
  const list: Option[] = [];
  if (takesLine(mnemonic)) list.push(...lineOptions(mnemonic, context.programLines));
  if (getSpec(mnemonic).modes.acc) {
    list.push({
      key: 'acc',
      label: 'a',
      group: 'Accumulator',
      hint: `${cycles(getSpec(mnemonic).modes.acc!)} · A itself`,
      action: { kind: 'operand', operand: { type: 'acc' } }
    });
  }
  const numeric = mnemonic === 'jmp' || !takesLine(mnemonic);
  if (numeric && context.typed !== null) list.push(...numberOptions(mnemonic, context.typed));
  return list;
}

function tokens(chosen: readonly Mos6502Action[]): DraftToken[] {
  return chosen.map((action, keep) =>
    action.kind === 'mnemonic'
      ? { label: action.mnemonic, head: true, keep }
      : { label: formatOperand(action.operand), keep }
  );
}

function build(chosen: readonly Mos6502Action[]): Instruction[] | null {
  const { mnemonic, operand } = wordsOf(chosen);
  if (mnemonic === null) return null;
  const instruction: Instruction = { mnemonic, operands: operand ? [operand] : [] };
  return isValid(instruction) ? [instruction] : null;
}

function parse({ mnemonic, operands }: Instruction): Mos6502Action[] {
  return [
    { kind: 'mnemonic', mnemonic },
    ...operands.map((operand) => ({ kind: 'operand', operand }) as const)
  ];
}

/** Whether the mnemonic can take a number, and the typed one fits none of its modes. */
function overflows(chosen: readonly Mos6502Action[], context: DraftContext): boolean {
  const { mnemonic, operand } = wordsOf(chosen);
  if (mnemonic === null || operand || context.typed === null) return false;
  if (takesLine(mnemonic) && mnemonic !== 'jmp') return false;
  const modes = modesOf(mnemonic);
  const numeric = NUMBER_MODES.filter(({ mode }) => modes.includes(mode));
  return numeric.length > 0 && !numeric.some(({ fits }) => fits(context.typed!));
}

/** How the builder builds 6502 instructions: a mnemonic, then the addressing mode of its operand. */
export const MOS6502_GRAMMAR: InstructionGrammar<Mos6502Action, Instruction> = {
  options,
  tokens,
  build,
  parse,
  hasMore(chosen) {
    const { mnemonic, operand } = wordsOf(chosen);
    if (mnemonic === null) return true;
    return operand === null && !getSpec(mnemonic).modes.imp;
  },
  overflows,
  hint(chosen, context, filter, complete) {
    const { mnemonic } = wordsOf(chosen);
    if (mnemonic === null) return 'Type to filter instructions';
    if (overflows(chosen, context)) return `${filter} fits none of ${mnemonic}'s addressing modes`;
    if (complete) return 'Enter: run now · Shift+Enter: add to the program';
    if (takesLine(mnemonic) && mnemonic !== 'jmp') return 'Pick a line, or type its number';
    const accumulator = getSpec(mnemonic).modes.acc ? ', or pick a for A' : '';
    return `Type a number ($2A, 42, 0x2A): every addressing mode it fits is offered${accumulator}`;
  },
  describe(chosen) {
    const { mnemonic, operand } = wordsOf(chosen);
    if (mnemonic === null) return null;
    const { description } = getSpec(mnemonic);
    const instruction: Instruction = { mnemonic, operands: operand ? [operand] : [] };
    const opcode = opcodeOf(instruction);
    if (!operand || !opcode) {
      const names = modesOf(mnemonic).map((mode) => MODE_NAMES[mode]);
      return { label: mnemonic, text: `${description}. Modes: ${names.join(', ')}` };
    }
    const mode = MODE_NAMES[modeOfInstruction(instruction)];
    return {
      label: mnemonic,
      text: `${description} · ${mode}, opcode $${hex(opcode.opcode, 2)}, ${cycles(opcode)}`
    };
  }
};
