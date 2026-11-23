import { list } from './explainText';

/** The one thing a learner is asked about an instruction before it runs. */
export type Question =
  | { kind: 'branch'; text: string }
  /** `register` is the name as the panels show it; `key` is how the predictor finds it again. */
  | { kind: 'value'; text: string; register: string; key: string; bits: 8 | 16 | 32 }
  | { kind: 'flags'; text: string; flags: string[] };

/** An answer to a question, and the shape of the truth it is checked against. */
export type Answer =
  | { kind: 'branch'; taken: boolean }
  | { kind: 'value'; value: number }
  /** The flags that are 1; every other flag of the question is 0. */
  | { kind: 'flags'; on: string[] };

/** How an answer did, in words. */
export interface Outcome {
  correct: boolean;
  /** What the CPU did: `AX is 000A`. */
  actual: string;
  /** What the learner answered, in the same words: `0009`. */
  said: string;
  /** Why the CPU did that, where the app can say; null when it cannot. */
  why: string | null;
}

/**
 * An architecture's side of prediction mode: the question an instruction deserves, and the
 * truth read from the instruction's record and the CPU right after it. Nothing is run to find
 * the answer ahead of time.
 */
export interface Predictor<Instruction, State, Record> {
  question(instruction: Instruction): Question | null;
  truth(question: Question, record: Record, state: State): Answer;
  /** `wrong` names the flags the learner got wrong, for a question about flags. */
  why(question: Question, record: Record, state: State, wrong: readonly string[]): string | null;
  formatValue(value: number, bits: number): string;
}

/** How many questions were answered, and how many of them rightly. */
export interface Tally {
  right: number;
  asked: number;
}

const HEX = /^-?[0-9a-f]+$/i;

/**
 * A value typed as hex, as the registers show it: `2A`, `0x2A`, `$2A`, `2Ah`. A negative number
 * stands for its two's complement. Null when it is not hex or does not fit in `bits`.
 */
export function parseAnswer(text: string, bits: number): number | null {
  const digits = text
    .trim()
    .replace(/^(-?)(0x|\$)/i, '$1')
    .replace(/h$/i, '');
  if (!HEX.test(digits)) return null;
  const value = parseInt(digits, 16);
  const range = 2 ** bits;
  if (value >= range || value < -range / 2) return null;
  return value < 0 ? value + range : value;
}

/** The flags of a question the answer got wrong. */
export function wrongFlags(question: Question, answer: Answer, truth: Answer): string[] {
  if (question.kind !== 'flags' || answer.kind !== 'flags' || truth.kind !== 'flags') return [];
  return question.flags.filter((flag) => answer.on.includes(flag) !== truth.on.includes(flag));
}

function flagValues(flags: readonly string[], on: readonly string[]): string {
  return list(flags.map((flag) => `${flag} = ${on.includes(flag) ? 1 : 0}`));
}

const moved = (taken: boolean): string => (taken ? 'it jumped' : 'it fell through');

/** Checks an answer against the truth. The two are of the question's kind. */
export function grade(
  question: Question,
  answer: Answer,
  truth: Answer,
  why: string | null,
  formatValue: (value: number, bits: number) => string
): Outcome {
  if (question.kind === 'branch' && answer.kind === 'branch' && truth.kind === 'branch') {
    return {
      correct: answer.taken === truth.taken,
      actual: moved(truth.taken),
      said: answer.taken ? 'it would jump' : 'it would fall through',
      why
    };
  }
  if (question.kind === 'value' && answer.kind === 'value' && truth.kind === 'value') {
    return {
      correct: answer.value === truth.value,
      actual: `${question.register} is ${formatValue(truth.value, question.bits)}`,
      said: formatValue(answer.value, question.bits),
      why
    };
  }
  if (question.kind === 'flags' && answer.kind === 'flags' && truth.kind === 'flags') {
    return {
      correct: wrongFlags(question, answer, truth).length === 0,
      actual: flagValues(question.flags, truth.on),
      said: flagValues(question.flags, answer.on),
      why
    };
  }
  throw new Error('An answer of another kind than its question');
}

/** The question as the learner is asked it, after the instruction's own text. */
export function promptOf(question: Question): string {
  switch (question.kind) {
    case 'branch':
      return 'Will it jump?';
    case 'value':
      return `What will ${question.register} hold?`;
    case 'flags':
      return 'Which flags will be 1?';
  }
}

/** How many hex digits a value of the question has. */
export function digitsOf(question: Extract<Question, { kind: 'value' }>): number {
  return question.bits / 4;
}

export function tallyText(tally: Tally): string {
  return `${tally.right} of ${tally.asked} right`;
}

export function counted(tally: Tally, outcome: Outcome): Tally {
  return { right: tally.right + (outcome.correct ? 1 : 0), asked: tally.asked + 1 };
}

/** The answer in one sentence: `Right: AX is 000A.` or `Not quite: AX is 000A; you said 0009.` */
export function verdict(outcome: Outcome): string {
  return outcome.correct
    ? `Right: ${outcome.actual}.`
    : `Not quite: ${outcome.actual}; you said ${outcome.said}.`;
}
