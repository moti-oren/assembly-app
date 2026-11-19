import type { Messages } from './messages/en';

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
  /** The interface's texts, for the groups and hints. */
  messages: Messages;
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
  /** Whether another word can still be chosen. */
  hasMore(chosen: readonly Action[]): boolean;
  /** Whether the typed number is too big for the immediate asked for. */
  overflows(chosen: readonly Action[], context: DraftContext): boolean;
  /** What the input says can be typed next; `filter` is the text as typed. */
  hint(chosen: readonly Action[], context: DraftContext, filter: string, complete: boolean): string;
  /** The chosen instruction explained, once there is one: what it does, or what it becomes. */
  describe(chosen: readonly Action[], messages: Messages): { label: string; text: string } | null;
}

/** The options the filter text leaves, in the order Enter should consider them. */
export function filterOptions<Action>(
  options: readonly BuilderOption<Action>[],
  filter: string,
  typed: number | null
): BuilderOption<Action>[] {
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
