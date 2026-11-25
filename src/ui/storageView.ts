import type { Width } from '@/core/logic/alu';
import { allBits, type ClockPhase, type RegisterRequest } from '@/core/logic/register';
import { hasRegisters, written, type RegisterLink, type RegisterWrite } from '@/core/registerLink';
import { PREFIXED, type HexStyle } from './hexNotation';
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
    ? `${link.unavailable} The register on show is one to try by hand.`
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

/**
 * Which of the CPU's writes `given` is, register and values alike; -1 when it is none of them,
 * a register the instruction did not write or one with something changed.
 */
export function cpuWriteIndex(writes: readonly RegisterWrite[], given: RegisterWrite): number {
  const same = (one: RegisterRequest, other: RegisterRequest) =>
    one.width === other.width &&
    one.held === other.held &&
    one.input === other.input &&
    one.enabled === other.enabled;
  return writes.findIndex(
    (write) => write.register === given.register && same(write.request, given.request)
  );
}

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

/** The cycle on one line: `AX: 1234h → 12FFh`, in the CPU’s own hex. */
export function equationText(
  { register, part, request }: RegisterWrite,
  stored: number,
  style: HexStyle = PREFIXED
): string {
  const { width, held } = request;
  const only = part ? ` (only ${part} is written)` : '';
  return `${register}: ${hexOf(held, width, style)} → ${hexOf(stored, width, style)}${only}`;
}

export function registerTitle({ register, request }: RegisterWrite): string {
  return `${register}: ${request.width} flip-flops`;
}

/**
 * What a write line the learner turned on does, where the CPU's did not: the instruction sent
 * the whole register to its inputs, so a bit it did not write waits there with the value it
 * already holds, and writing it changes nothing. Null where no such bit is written.
 */
export function rewrittenText(request: RegisterRequest, cpuEnabled: number): string | null {
  const bits = Array.from({ length: request.width }, (_, bit) => bit).filter((bit) => {
    const mask = 2 ** bit;
    const added = (request.enabled & mask) !== 0 && (cpuEnabled & mask) === 0;
    return added && (request.input & mask) === (request.held & mask);
  });
  if (bits.length === 0) return null;
  const first = bits[0];
  const last = bits[bits.length - 1];
  const range = last - first === bits.length - 1 ? `${first} to ${last}` : bits.join(', ');
  const which =
    bits.length === 1
      ? `Bit ${first} is written too, with the ${(request.held >>> first) & 1} it already held`
      : `Bits ${range} are written too, with what they already held`;
  return `${which}: the inputs carry the whole register as the instruction left it, so writing the bits it did not write changes nothing.`;
}

/**
 * What is going on at a moment of the clock cycle, by which bits the write lines let in: all of
 * them, some, or none.
 */
export function phaseText(phase: ClockPhase, request: RegisterRequest): string {
  const all = allBits(request.width);
  const enabled = request.enabled & all;
  if (enabled === 0) {
    if (phase === 'before')
      return 'The clock is low, and no write line is on: whatever waits at the inputs will not get in.';
    if (phase === 'high')
      return 'The clock has risen, but no write line is on: every flip-flop took its own output back, and nothing changed.';
    return 'The clock is low again. No write line was on, so the register still holds what it held.';
  }
  const some = enabled !== all;
  if (phase === 'before')
    return some
      ? 'The clock is low. The new value waits at the inputs of the bits that are written, and the register still holds the old one.'
      : 'The clock is low. The new value waits at the inputs, and the register still holds the old one.';
  if (phase === 'high')
    return 'The clock has risen: at that moment every written bit took its input. Nothing else can get in until it rises again.';
  return some
    ? 'The clock is low again. The written bits hold their new value and the others what they held, through every cycle that does not write them.'
    : 'The clock is low again. The register holds the new value, and will hold it through every cycle that does not write it.';
}

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

/** For each bit, bit 0 first, whether its write line is off: those bits keep what they held. */
export function keptBits({ width, enabled }: RegisterRequest): boolean[] {
  return Array.from({ length: width }, (_, bit) => ((enabled >>> bit) & 1) === 0);
}
