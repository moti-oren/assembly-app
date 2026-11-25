import { solvePc } from '@/core/logic/programCounter';
import { formatRegister } from '@/core/rv32/operands';
import type {
  AluInput,
  MemoryStep,
  PathConflict,
  PathOutcome,
  RegisterWrite
} from '@/core/rv32ControlPath';
import { controlLabel } from './controlView';
import { hexOf } from './logicView';

const hex = (value: number): string => hexOf(value, 32);

/** One thing the datapath did with the word, beside what it does with every line working. */
export interface EffectRow {
  id: string;
  label: string;
  text: string;
  /** What it would be with no line broken, when that is something else. */
  instead: string | null;
}

function inputText(input: AluInput, { rs1, rs2 }: PathOutcome): string {
  switch (input.from) {
    case 'pc':
      return `PC, ${hex(input.value)}`;
    case 'immediate':
      return `the immediate, ${hex(input.value)}`;
    case 'rs1':
      return `rs1 (${formatRegister(rs1.index)}), ${hex(input.value)}`;
    case 'rs2':
      return `rs2 (${formatRegister(rs2.index)}), ${hex(input.value)}`;
  }
}

const bytes = (size: number): string => (size === 1 ? '1 byte' : `${size} bytes`);

function memoryText({ loaded, stored }: PathOutcome): string {
  const read = (step: MemoryStep) =>
    step.value === null
      ? `a read of ${bytes(step.size)} at ${hex(step.address)} traps`
      : `reads ${bytes(step.size)} at ${hex(step.address)}: ${hexOf(step.value, 32)}`;
  const write = (step: MemoryStep) =>
    step.value === null
      ? `a write of ${bytes(step.size)} at ${hex(step.address)} does not happen`
      : `writes ${hex(step.value)} as ${bytes(step.size)} at ${hex(step.address)}`;
  const parts = [...(loaded ? [read(loaded)] : []), ...(stored ? [write(stored)] : [])];
  return parts.length ? parts.join(', and ') : 'not used';
}

const SOURCES: Record<RegisterWrite['from'], string> = {
  alu: 'the ALU’s result',
  memory: 'what memory gave',
  link: 'PC + 4',
  immediate: 'the immediate'
};

function writeText({ write, trap, loaded }: PathOutcome): string {
  if (trap) return 'nothing is written: the CPU trapped';
  if (!write) return 'nothing is written';
  // A signed load of a byte or a half fills the bits above it with copies of its top bit.
  const widened =
    write.from === 'memory' && loaded?.value != null && loaded.value !== write.value
      ? ', with its top bit copied up'
      : '';
  const value = `${hex(write.value)}, ${SOURCES[write.from]}${widened}`;
  return write.index === 0
    ? `${value}, is sent to x0, which is wired to 0 and keeps nothing`
    : `${formatRegister(write.index)} takes ${value}`;
}

/** What each part of the datapath did, as one line of text for each. */
function effectTexts(outcome: PathOutcome): Omit<EffectRow, 'instead'>[] {
  const { a, b, result, pc, taken, write, loaded, stored, trap } = outcome;
  // The ALU's inputs are wired whatever the instruction: say so where rd takes something else
  // (LUI's immediate, JAL's link) and nothing else reads the ALU.
  const unused =
    (write?.from === 'immediate' || write?.from === 'link') &&
    !loaded &&
    !stored &&
    !pc.branch &&
    !pc.jumpComputed;
  const input = (side: AluInput) =>
    `${inputText(side, outcome)}${unused ? ': on the wires all the same, though nothing uses the ALU’s result' : ''}`;
  const next = hex(solvePc(pc).register.stored);
  return [
    { id: 'a', label: 'ALU input A', text: input(a) },
    { id: 'b', label: 'ALU input B', text: input(b) },
    {
      id: 'result',
      label: 'ALU result',
      text: result === null ? 'none: no line puts anything on the ALU’s output' : hex(result)
    },
    ...(pc.branch
      ? [{ id: 'taken', label: 'Comparison', text: taken ? 'true: branch' : 'false: go on' }]
      : []),
    { id: 'memory', label: 'Memory', text: memoryText(outcome) },
    { id: 'rd', label: 'Register', text: writeText(outcome) },
    {
      id: 'pc',
      label: 'PC',
      text: trap ? `would go to ${next}, but the CPU trapped` : `goes to ${next}`
    }
  ];
}

/**
 * What the datapath does with the word on show, a row per part, and for every row that a broken
 * line changed what it would be with every line working (`whole`).
 */
export function effectRows(outcome: PathOutcome, whole: PathOutcome | null): EffectRow[] {
  const built = new Map((whole ? effectTexts(whole) : []).map((row) => [row.id, row.text]));
  return effectTexts(outcome).map((row) => {
    const text = whole ? (built.get(row.id) ?? 'not there') : row.text;
    return { ...row, instead: text === row.text ? null : text };
  });
}

/** How far the broken lines reach for this instruction, in one sentence. */
export function effectSummary(rows: readonly EffectRow[]): string {
  const changed = rows.filter((row) => row.instead !== null).map((row) => row.label);
  return changed.length === 0
    ? 'For this instruction the broken lines change nothing: it does what it would have done.'
    : `With the broken lines this comes out differently: ${changed.join(', ')}.`;
}

const names = (lines: readonly string[]): string => lines.map(controlLabel).join(' and ');

const CONFLICTS: Record<PathConflict['kind'], (lines: readonly string[]) => string> = {
  immediate: (lines) =>
    `${names(lines)} are both 1: two layouts of the immediate at once. The first is taken here; real wires would fight.`,
  result: (lines) =>
    `${names(lines)} are both 1: two circuits drive the ALU’s output at once. The first is taken here; real wires would fight.`,
  wire: (lines) =>
    `${names(lines)} are both 1: the branch reads two wires at once. The first is taken here.`,
  source: (lines) =>
    `${names(lines)} are both 1: two values are sent to rd at once. The first is taken here; real wires would fight.`,
  noResult: (lines) =>
    `${names(lines)} uses the ALU’s result, and no line puts anything on the ALU’s output: it is taken as 0 here.`,
  notRead: () =>
    'ResultMem sends what memory gave to rd, but MemRead is 0: memory gave nothing, taken as 0 here.',
  size: () => 'funct3 asks for an access of a size this CPU has none of: a word is taken here.',
  illegal: () =>
    'This word is no instruction this CPU runs. A real CPU checks every bit and refuses a word it has no instruction for; here the lines are followed as the decoders set them.'
};

/** What a working control unit would never ask for, in words. */
export function conflictText({ kind, lines }: PathConflict): string {
  return CONFLICTS[kind](lines);
}
