import { plural, type ChallengeResult } from '@/core/shared/challenge';
import { formatLabel } from '@/core/shared/program';

/** What the pages show of a challenge, whatever CPU it is for. */
export interface ChallengeInfo {
  id: string;
  title: string;
  brief: string;
  hint: string;
  par: number;
}

const lines = (count: number) => plural(count, 'line');

/**
 * Which lines the program starts with and must keep; null when it starts empty. With `limited`,
 * it says the limits are on the lines written under them, so a given MOV breaks no "No MOV".
 */
export function givenNote(given: number, limited = false): string | null {
  if (given === 0) return null;
  const which =
    given === 1 ? `${formatLabel(0)} is` : `${formatLabel(0)} to ${formatLabel(given - 1)} are`;
  const note = `${which} given, and locked: write under ${given === 1 ? 'it' : 'them'}.`;
  return limited ? `${note} The limits count only the lines you write.` : note;
}

/**
 * Whether where the program stands is worth saying aloud: it passed, or it cannot pass as it is.
 * How many of the conditions are met changes with every edit, and the list already says it.
 */
export function isNews(result: ChallengeResult): boolean {
  return result.solved || !result.givenKept || result.error !== null;
}

/** Where the program stands, in a sentence. */
export function outcomeText(result: ChallengeResult, par: number): string {
  if (!result.givenKept) return 'The given lines were changed. Start over to get them back.';
  if (result.solved) {
    const how = `Solved in ${lines(result.lines)}`;
    return result.lines <= par ? `${how}: that is par.` : `${how}. It can be done in ${par}.`;
  }
  if (result.error) return `The program stopped: ${result.error}`;
  if (result.lines === 0) return 'Nothing written yet.';
  const all = [...result.goals, ...result.limits];
  const count = `${all.filter((verdict) => verdict.met).length} of ${all.length} met.`;
  // The program is also run from other starting values, which the page never shows.
  return result.onlyAsGiven
    ? `${count} It works with the given lines on show, but not when they start it from other values: the answer has to be worked out, not written in.`
    : count;
}

/** What the list says of a challenge that was solved: the fewest lines it took. */
export function solvedText(best: number, par: number): string {
  return best <= par ? `Solved in ${lines(best)}, par` : `Solved in ${lines(best)}; par is ${par}`;
}
