import { CpuError } from './cpuError';
import {
  isFinished,
  MAX_RUN_WRITES,
  MAX_STEPS,
  step,
  tooManySteps,
  tooManyWrites,
  type LineRunner,
  type Program,
  type ProgramInstruction
} from './program';
import type { MemoryWrite } from './state';

/**
 * A challenge: a small task a learner writes a program for, and how that program is judged. It is
 * always judged by running it on a fresh CPU, never on the one the learner is looking at.
 */

/** What a challenge needs of an instruction: operands to look through, and a name to forbid. */
export type ChallengeInstruction = ProgramInstruction & { readonly mnemonic: string };

/**
 * One run a solution must pass. `given` are the lines the program starts with, which the learner
 * does not write; `met` says, for each goal of the challenge in order, whether the CPU the run
 * left meets it.
 */
export interface ChallengeCase<Instruction, State> {
  given: Program<Instruction>;
  /**
   * Changes the fresh CPU before the run: other values in the registers and memory a solution
   * has no business relying on, so one that reads a zero a fresh CPU happens to hold fails.
   */
  setup?: (state: State) => void;
  met: readonly ((state: State) => boolean)[];
}

/** Some instructions a solution may not use, and what to call them: `No MUL or IMUL`. */
export interface Banned {
  label: string;
  mnemonics: readonly string[];
}

/** What the learner's own lines must keep to. */
export interface ChallengeLimits {
  /** The most lines the learner may write. */
  lines?: number;
  /** Instructions the learner may not use, in groups that are each one line of the list. */
  without?: readonly Banned[];
  /** No number written in an instruction: every value must come from the CPU itself. */
  noNumbers?: boolean;
}

export interface Challenge<Instruction extends ChallengeInstruction, State> {
  /** Short and stable: it is what is remembered of a solved challenge. */
  id: string;
  title: string;
  /** The task, in a sentence or two. */
  brief: string;
  hint: string;
  /** What must be true when the program ends, in words; each case tests them in this order. */
  goals: readonly string[];
  /**
   * The runs a solution must pass, at least one. With several, their given lines hold different
   * values and are equally long, so a program cannot simply write down the answer, and its jump
   * targets mean the same lines in each.
   */
  cases: readonly ChallengeCase<Instruction, State>[];
  limits?: ChallengeLimits;
  /** The lines a good solution takes, not counting the given ones. */
  par: number;
}

/** One goal or limit, and whether the program keeps to it. */
export interface Verdict {
  label: string;
  met: boolean;
}

export interface ChallengeResult {
  goals: Verdict[];
  limits: Verdict[];
  /** Whether the program still starts with the given lines. */
  givenKept: boolean;
  /** Why a run stopped early, when one did. */
  error: string | null;
  /** The lines the learner wrote. */
  lines: number;
  solved: boolean;
  /**
   * Whether every goal is met with the given lines on show (the first case), yet not with the
   * others: an answer written down rather than worked out.
   */
  onlyAsGiven: boolean;
}

/** The lines every program for the challenge starts with: those of its first case. */
export function givenLines<Instruction extends ChallengeInstruction, State>(
  challenge: Challenge<Instruction, State>
): Program<Instruction> {
  return challenge.cases[0].given;
}

function sameLines(a: Program<unknown>, b: Program<unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * How many lines at the top of `program` are the challenge's given ones, which an editor keeps as
 * they are: all of them, or none once the program no longer starts with them.
 */
export function keptGiven(
  challenge: { readonly cases: readonly { readonly given: Program<unknown> }[] },
  program: Program<unknown>
): number {
  const given = challenge.cases[0].given;
  return sameLines(program.slice(0, given.length), given) ? given.length : 0;
}

/** A count with its noun: `1 line`, `3 lines`. */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function limitVerdicts(limits: ChallengeLimits, own: Program<ChallengeInstruction>): Verdict[] {
  const verdicts: Verdict[] = [];
  if (limits.lines !== undefined) {
    verdicts.push({
      label: `At most ${plural(limits.lines, 'line')}`,
      met: own.length <= limits.lines
    });
  }
  for (const { label, mnemonics } of limits.without ?? []) {
    verdicts.push({
      label,
      met: own.every((instruction) => !mnemonics.includes(instruction.mnemonic))
    });
  }
  if (limits.noNumbers) {
    verdicts.push({
      label: 'No number written in an instruction',
      met: own.every(({ operands }) => operands.every((operand) => operand.type !== 'imm'))
    });
  }
  return verdicts;
}

/**
 * Runs a program to its end as `runToEnd` does, with the same limits, but keeps none of the
 * records: judging runs a program on every edit and only looks at the CPU it leaves.
 */
function runQuietly<Instruction, State>(
  cpu: LineRunner<Instruction, State, { memoryWrites: MemoryWrite[] }>,
  state: State,
  program: Program<Instruction>
): CpuError | null {
  let steps = 0;
  let writes = 0;
  while (!isFinished(cpu, state, program)) {
    if (steps >= MAX_STEPS) return tooManySteps();
    if (writes >= MAX_RUN_WRITES) return tooManyWrites();
    try {
      writes += step(cpu, state, program).memoryWrites.length;
      steps += 1;
    } catch (caught) {
      if (caught instanceof CpuError) return caught;
      throw caught;
    }
  }
  return null;
}

/**
 * Judges `program` against a challenge: runs it from a fresh CPU once for each case, with that
 * case's given lines in place of the ones it starts with, and says which goals every run met.
 */
export function checkChallenge<Instruction extends ChallengeInstruction, State>(
  cpu: LineRunner<Instruction, State, { memoryWrites: MemoryWrite[] }> & { createState(): State },
  challenge: Challenge<Instruction, State>,
  program: Program<Instruction>
): ChallengeResult {
  const given = givenLines(challenge);
  const givenKept = keptGiven(challenge, program) === given.length;
  const own = givenKept ? program.slice(given.length) : program;
  const met = challenge.goals.map(() => givenKept);
  let error: string | null = null;
  let firstMet = false;
  (givenKept ? challenge.cases : []).forEach((each, index) => {
    const state = cpu.createState();
    each.setup?.(state);
    const stopped = runQuietly(cpu, state, [...each.given, ...own]);
    error ??= stopped?.message ?? null;
    const passed = each.met.map((test) => stopped === null && test(state));
    if (index === 0) firstMet = passed.every(Boolean);
    passed.forEach((ok, goal) => {
      met[goal] &&= ok;
    });
  });
  const goals = challenge.goals.map((label, goal) => ({ label, met: met[goal] }));
  const limits = limitVerdicts(challenge.limits ?? {}, own);
  return {
    goals,
    limits,
    givenKept,
    error,
    lines: own.length,
    solved: givenKept && [...goals, ...limits].every((verdict) => verdict.met),
    // A run that stopped is its own reason, said first: not an answer written in.
    onlyAsGiven: firstMet && error === null && goals.some((verdict) => !verdict.met)
  };
}
