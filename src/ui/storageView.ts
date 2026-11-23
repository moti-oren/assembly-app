import type { Width } from '@/core/logic/alu';
import type { ClockPhase, RegisterRequest } from '@/core/logic/register';
import {
  allBits,
  hasRegisters,
  written,
  type RegisterLink,
  type RegisterWrite
} from '@/core/registerLink';
import { hexOf } from './logicView';

/** The memory cells the storage topic builds up, the simplest first. */
export const CELLS = [
  { id: 'sr', label: 'SR latch' },
  { id: 'd', label: 'D latch' },
  { id: 'flipFlop', label: 'Flip-flop' },
  { id: 'register', label: 'Register bit' }
] as const;

export type CellId = (typeof CELLS)[number]['id'];

export function cellLabel(id: CellId): string {
  return CELLS.find((choice) => choice.id === id)?.label ?? id;
}

/** Why the CPU's last instruction has no register to show, or null when it has one or none ran. */
export function unavailableText(link: RegisterLink | null): string | null {
  return link && !hasRegisters(link)
    ? `${link.unavailable} The register below is one to try by hand.`
    : null;
}

/** The registers to pick between: none when the instruction wrote only one. */
export function registerChoices(writes: readonly RegisterWrite[]): readonly RegisterWrite[] {
  return writes.length > 1 ? writes : [];
}

/** A cell the learner works by hand; the register's bit follows the register above it. */
export type FreeCellId = Exclude<CellId, 'register'>;

/** A row of the register the learner can change a bit of. */
export type RegisterRow = 'input' | 'enabled';

/** A register no CPU wrote, keeping the values of `from` as far as they fit. */
export function freeWrite(width: Width, from: RegisterRequest | null): RegisterWrite {
  const all = allBits(width);
  const fit = (value: number) => (value & all) >>> 0;
  return written(
    'Register',
    width,
    fit(from ? from.held : 0b0011_1100),
    fit(from ? from.input : 0b1010_0101),
    from && from.width === width ? from.enabled : all
  );
}

/** The request with one bit of a row flipped. */
export function withBitFlipped(
  request: RegisterRequest,
  row: RegisterRow,
  bit: number
): RegisterRequest {
  return { ...request, [row]: (request[row] ^ (2 ** bit)) >>> 0 };
}

/** The cycle on one line: `AX: 0x1234 → 0x12FF`. */
export function equationText({ register, part, request }: RegisterWrite, stored: number): string {
  const { width, held } = request;
  const only = part ? ` (only ${part} is written)` : '';
  return `${register}: ${hexOf(held, width)} → ${hexOf(stored, width)}${only}`;
}

export function registerTitle({ register, request }: RegisterWrite): string {
  return `${register}: ${request.width} flip-flops`;
}

/** What is going on at each moment of the clock cycle. */
export const PHASE_TEXT: Record<ClockPhase, string> = {
  before:
    'The clock is low. The new value waits at the inputs, and the register still holds the old one.',
  high: 'The clock has risen: at that moment every written bit took its input. Nothing else can get in until it rises again.',
  after:
    'The clock is low again. The register holds the new value, and will hold it through every cycle that does not write it.'
};

/** What the clock button does next. */
export const CLOCK_ACTION: Record<ClockPhase, string> = {
  before: 'Raise the clock',
  high: 'Lower the clock',
  after: 'Raise the clock'
};

/** The moment the clock button leads to. */
export const NEXT_PHASE: Record<ClockPhase, ClockPhase> = {
  before: 'high',
  high: 'after',
  after: 'high'
};

export const CELL_LESSONS: Record<CellId, string> = {
  sr: 'Two NOR gates, each reading the other’s output. That loop is the memory: S sets the bit to 1, R resets it to 0, and with both at 0 the gates keep telling each other what it was. Both at 1 is the one thing it must not be asked: try it.',
  d: 'An SR latch with two gates in front of it, so that S and R can never be 1 together. While E is 1 the bit follows D; when E drops, it keeps what D was.',
  flipFlop:
    'Two D latches in a row, opened by opposite halves of the clock. The first takes D in while the clock is low, the second shows it once the clock is high, so Q changes only at the moment the clock rises.',
  register:
    'A flip-flop and, before it, a switch. With the write line at 1 the switch passes the input; at 0 it passes the bit’s own output back in, so a clock edge changes nothing.'
};

/** The inputs of each cell that is worked by hand, in the order their switches are shown. */
export const CELL_INPUTS: Record<FreeCellId, readonly { signal: string; label: string }[]> = {
  sr: [
    { signal: 's', label: 'S' },
    { signal: 'r', label: 'R' }
  ],
  d: [
    { signal: 'd', label: 'D' },
    { signal: 'e', label: 'E' }
  ],
  flipFlop: [
    { signal: 'd', label: 'D' },
    { signal: 'clk', label: 'Clock' }
  ]
};

export const UNSETTLED =
  'The latch cannot decide. Both inputs were let go at the same moment, so each gate waits for the other and they flip for ever; a real one falls to 0 or to 1 by chance. Press S or R to give it a bit again.';
