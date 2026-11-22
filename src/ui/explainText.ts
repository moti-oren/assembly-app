/** Items as a sentence lists them: `A`, `A and B`, `A, B and C`. */
export function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** A conditional jump that ran: its condition, the values it tested, and what came of it. */
export interface BranchOutcome {
  /** The instruction as the sentence names it: `JGE`. */
  name: string;
  /** What the architecture calls it: the 8086 jumps, RISC-V and the 6502 branch. */
  verb: 'jumps' | 'branches';
  /** The condition it needs: `SF = OF`. */
  when: string;
  /** What the condition found, one phrase per value: `SF is 1`. */
  values: readonly string[];
  taken: boolean;
}

/** Why a conditional jump was taken or not, in the same words on every CPU. */
export function describeBranch({ name, verb, when, values, taken }: BranchOutcome): string {
  return `${taken ? 'Taken' : 'Not taken'}: ${name} ${verb} when ${when}, ${taken ? 'and' : 'but'} ${list(values)}.`;
}
