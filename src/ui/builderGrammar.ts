import { parseNumber } from '@/core/shared/numbers';

/** One choice the builder offers for the next word of an instruction. */
export interface BuilderOption<Action> {
  key: string;
  label: string;
  group: string;
  hint?: string;
  /** For options a typed number can select: immediates, addresses, counts, line labels. */
  matchesNumber?: (value: number) => boolean;
  action: Action;
}

/** One word of the instruction as the builder shows it. */
export interface DraftToken {
  label: string;
  /** A word that is still being chosen, e.g. a memory operand without its address yet. */
  pending?: boolean;
  /** The mnemonic, or a prefix before it, which head the instruction. */
  head?: boolean;
  /** How many chosen words remain when this one is removed with everything after it. */
  keep: number;
}

/** What the builder knows besides the words chosen so far. */
export interface DraftContext {
  /** The text in the filter as a number, or null when it is not one. */
  typed: number | null;
  /** The program, formatted, so jumps can offer its lines as targets. */
  programLines: readonly string[];
}

/**
 * How one architecture's instructions are built word by word. The builder keeps the words
 * chosen so far (`chosen`, one action per choice) and asks the grammar everything else.
 */
export interface InstructionGrammar<Action, Instruction> {
  /** Every choice for the next word. */
  options(chosen: readonly Action[], context: DraftContext): BuilderOption<Action>[];
  tokens(chosen: readonly Action[]): DraftToken[];
  /**
   * The instructions the words stand for once they are complete, else null. A pseudo-instruction
   * stands for more than one.
   */
  build(chosen: readonly Action[]): Instruction[] | null;
  /**
   * The words a real instruction is made of, for editing a program line: the reverse of `build`.
   */
  parse(instruction: Instruction): Action[];
  /** Whether another word can still be chosen. */
  hasMore(chosen: readonly Action[]): boolean;
  /** Whether the typed number is too big for the immediate asked for. */
  overflows(chosen: readonly Action[], context: DraftContext): boolean;
  /** What the input says can be typed next; `filter` is the text as typed. */
  hint(chosen: readonly Action[], context: DraftContext, filter: string, complete: boolean): string;
  /** The chosen instruction explained, once there is one: what it does, or what it becomes. */
  describe(chosen: readonly Action[]): { label: string; text: string } | null;
}

/**
 * The number in what was typed, as an operand is written around it: `#$10`, `($10),y`, `$10,x`
 * and `8(sp)` all hold one. Null when the text does not start with a number.
 */
export function typedNumberIn(filter: string): number | null {
  const plain = parseNumber(filter);
  if (plain !== null) return plain;
  const match = /^[#([]*(-?(?:0x[0-9a-f_]+|\$[0-9a-f_]+|0b[01_]+|[0-9][0-9a-f_]*h|[0-9_]+))/i.exec(
    filter.trim()
  );
  return match ? parseNumber(match[1]) : null;
}

const normal = (text: string) => text.replace(/\s+/g, '').toLowerCase();

/** The options the filter text leaves, in the order Enter should consider them. */
export function filterOptions<Action>(
  options: readonly BuilderOption<Action>[],
  filter: string,
  typed: number | null
): BuilderOption<Action>[] {
  const text = filter.trim().toLowerCase();
  if (!text) return [...options];
  if (typed !== null) {
    // A typed number only selects the options that accept that number, and a number written
    // as an operand (`#$10`, `$10,x`) puts the option written that way first.
    const numeric = options.filter((option) => option.matchesNumber?.(typed));
    const exact = numeric.filter((option) => normal(option.label) === normal(filter));
    return [...exact, ...numeric.filter((option) => !exact.includes(option))];
  }
  // Matches that start with the typed text come first, so Enter picks the obvious one.
  const matches = options.filter((option) => option.label.toLowerCase().includes(text));
  return [
    ...matches.filter((option) => option.label.toLowerCase().startsWith(text)),
    ...matches.filter((option) => !option.label.toLowerCase().startsWith(text))
  ];
}

/**
 * Where typed text holds a whole word and the start of the next, as `mov ax 3` or `t0, zero`
 * do: the first word, and the rest. A space or a comma ends a word unless some option goes on
 * past it (`$10,x`); `8(sp)` is an offset and then its register. `goesOn` says whether some
 * option's label starts with the text given. Null when the text is still one word.
 */
export function splitWord(
  filter: string,
  goesOn: (text: string) => boolean
): { word: string; rest: string } | null {
  for (let i = 0; i < filter.length; i++) {
    if (filter[i] !== ' ' && filter[i] !== ',') continue;
    const word = filter.slice(0, i).trim();
    if (word && !goesOn(filter.slice(0, i + 1).trimStart()))
      return { word, rest: filter.slice(i + 1).trimStart() };
  }
  const offset = /^\s*([^\s,()]+)\(([^()]*)\)?\s*$/.exec(filter);
  if (offset && !goesOn(filter.trim())) return { word: offset[1], rest: offset[2] };
  return null;
}
