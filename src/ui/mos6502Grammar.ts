import { formatLabel } from '@/core/shared/program';
import {
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
import type { BuilderOption, DraftContext, DraftToken, InstructionGrammar } from './builderGrammar';
import type { Messages } from './messages/en';

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

function cycles(m: Messages, { cycles: count, pageCross }: Opcode): string {
  return m.builder6502.cycles(count, pageCross ?? false);
}

const byte = (value: number) => Number.isInteger(value) && value >= 0 && value <= 0xff;
const word = (value: number) => Number.isInteger(value) && value >= 0 && value <= 0xffff;

/** The modes a typed number can be, and how each one writes the number in its meaning. */
type NumberMode = keyof Messages['builder6502']['meanings'];

/** Each mode a typed number can be, in the order they are offered. */
const NUMBER_MODES: {
  mode: NumberMode;
  fits: (value: number) => boolean;
  operand: (value: number) => Operand;
  shown: (value: number) => string;
}[] = [
  {
    mode: 'imm',
    fits: (v) => Number.isInteger(v) && v >= -128 && v <= 0xff,
    operand: (v) => ({ type: 'imm', value: v }),
    shown: (v) => `$${hex(v & 0xff, 2)}`
  },
  {
    mode: 'zp',
    fits: byte,
    operand: (v) => ({ type: 'zp', address: v, index: null }),
    shown: (v) => `$${hex(v, 4)}`
  },
  {
    mode: 'zpx',
    fits: byte,
    operand: (v) => ({ type: 'zp', address: v, index: 'x' }),
    shown: (v) => `$${hex(v, 2)}`
  },
  {
    mode: 'zpy',
    fits: byte,
    operand: (v) => ({ type: 'zp', address: v, index: 'y' }),
    shown: (v) => `$${hex(v, 2)}`
  },
  {
    mode: 'abs',
    fits: word,
    operand: (v) => ({ type: 'abs', address: v, index: null }),
    shown: (v) => `$${hex(v, 4)}`
  },
  {
    mode: 'abx',
    fits: word,
    operand: (v) => ({ type: 'abs', address: v, index: 'x' }),
    shown: (v) => `$${hex(v, 4)}`
  },
  {
    mode: 'aby',
    fits: word,
    operand: (v) => ({ type: 'abs', address: v, index: 'y' }),
    shown: (v) => `$${hex(v, 4)}`
  },
  {
    mode: 'ind',
    fits: word,
    operand: (v) => ({ type: 'ind', address: v }),
    shown: (v) => `$${hex(v, 4)}`
  },
  {
    mode: 'izx',
    fits: byte,
    operand: (v) => ({ type: 'izx', address: v }),
    shown: (v) => `$${hex(v, 2)}`
  },
  {
    mode: 'izy',
    fits: byte,
    operand: (v) => ({ type: 'izy', address: v }),
    shown: (v) => `$${hex(v, 2)}`
  }
];

/** JMP and JSR take a program line, not a number: the line's address is worked out for them. */
const takesLine = (mnemonic: Mnemonic) =>
  isBranch(mnemonic) || mnemonic === 'jsr' || mnemonic === 'jmp';

function mnemonicOptions(m: Messages): Option[] {
  return MNEMONICS.map((mnemonic) => {
    const { category } = getSpec(mnemonic);
    return {
      key: mnemonic,
      label: mnemonic,
      group: m.mos6502Text.category(category),
      hint: m.mos6502Text.description(mnemonic),
      action: { kind: 'mnemonic', mnemonic }
    };
  });
}

function numberOptions(m: Messages, mnemonic: Mnemonic, typed: number): Option[] {
  const { modes } = getSpec(mnemonic);
  // JMP's absolute mode is its line: a number there could land between two lines.
  const offered = (mode: Mode) => modes[mode] && !(mode === 'abs' && takesLine(mnemonic));
  return NUMBER_MODES.filter(({ mode, fits }) => offered(mode) && fits(typed)).map(
    ({ mode, operand, shown }) => {
      const chosen = operand(typed);
      return {
        key: mode,
        label: formatOperand(chosen),
        group: `${MODE_NAMES[mode][0].toUpperCase()}${MODE_NAMES[mode].slice(1)}`,
        hint: `${m.builder6502.meanings[mode](shown(typed))} · ${cycles(m, modes[mode]!)}`,
        matchesNumber: () => true,
        action: { kind: 'operand', operand: chosen }
      };
    }
  );
}

function lineOptions(m: Messages, mnemonic: Mnemonic, programLines: readonly string[]): Option[] {
  return Array.from({ length: programLines.length + 1 }, (_, target) => ({
    key: `label${target}`,
    label: formatLabel(target),
    group: isBranch(mnemonic) ? m.builderCommon.branchTo : m.builderCommon.jumpTo,
    hint: programLines[target] ?? m.builderCommon.endOfProgram,
    matchesNumber: (value: number) => value === target,
    action: { kind: 'operand', operand: { type: 'label', target } }
  }));
}

function options(chosen: readonly Mos6502Action[], context: DraftContext): Option[] {
  const m = context.messages;
  const { mnemonic, operand } = wordsOf(chosen);
  if (mnemonic === null) return mnemonicOptions(m);
  if (operand) return [];
  const list: Option[] = [];
  if (takesLine(mnemonic)) list.push(...lineOptions(m, mnemonic, context.programLines));
  if (getSpec(mnemonic).modes.acc) {
    list.push({
      key: 'acc',
      label: 'a',
      group: m.builder6502.accumulator,
      hint: m.builder6502.aItself(cycles(m, getSpec(mnemonic).modes.acc!)),
      action: { kind: 'operand', operand: { type: 'acc' } }
    });
  }
  const numeric = mnemonic === 'jmp' || !takesLine(mnemonic);
  if (numeric && context.typed !== null) list.push(...numberOptions(m, mnemonic, context.typed));
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
  hasMore(chosen) {
    const { mnemonic, operand } = wordsOf(chosen);
    if (mnemonic === null) return true;
    return operand === null && !getSpec(mnemonic).modes.imp;
  },
  overflows,
  hint(chosen, context, filter, complete) {
    const { builder6502: b, builderCommon: common } = context.messages;
    const { mnemonic } = wordsOf(chosen);
    if (mnemonic === null) return common.filterInstructions;
    if (overflows(chosen, context)) return b.fitsNone(filter, mnemonic);
    if (complete) return common.runOrAdd;
    if (takesLine(mnemonic) && mnemonic !== 'jmp') return b.pickLine;
    return b.typeNumber(!!getSpec(mnemonic).modes.acc);
  },
  describe(chosen, m) {
    const { mnemonic, operand } = wordsOf(chosen);
    if (mnemonic === null) return null;
    const description = m.mos6502Text.description(mnemonic);
    const instruction: Instruction = { mnemonic, operands: operand ? [operand] : [] };
    const opcode = opcodeOf(instruction);
    if (!operand || !opcode) {
      const names = modesOf(mnemonic).map((mode) => MODE_NAMES[mode]);
      return { label: mnemonic, text: m.builder6502.modes(description, names.join(', ')) };
    }
    const mode = MODE_NAMES[modeOfInstruction(instruction)];
    return {
      label: mnemonic,
      text: m.builder6502.withOpcode(
        description,
        mode,
        `$${hex(opcode.opcode, 2)}`,
        cycles(m, opcode)
      )
    };
  }
};
