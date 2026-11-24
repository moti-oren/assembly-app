import { solveDecoder, type DecoderShape, type DecoderSolution } from './logic/decoder';
import type { Faults } from './logic/fault';
import { bitOf, type Bit } from './logic/gates';
import type { PcRequest } from './logic/programCounter';

/**
 * The control unit of a CPU as two decoders: the main one reads the opcode and says what kind of
 * instruction this is, and the second reads the main one's wires and the rest of the word's
 * function bits and says what the ALU does.
 */
export interface ControlShape {
  /** The bit of the instruction word behind each wire the decoders read. */
  wires: Readonly<Record<string, number>>;
  /** The fields of a word the decoders read, whatever instruction it holds, top bit first. */
  reads: readonly WordField[];
  main: DecoderShape;
  alu: DecoderShape;
}

/** One field of an instruction word: bits `high` down to `low`. */
export interface WordField {
  label: string;
  high: number;
  low: number;
  note: string;
  /** Whether a decoder reads it to tell one instruction from another. */
  decoded: boolean;
}

/** What a read of memory gave: the bytes as an unsigned number, low byte first, or a fault. */
export type MemoryRead = number | { fault: string };

/** Memory as an instruction found it, for a datapath that does the instruction again. */
export interface ControlMemory {
  read: (address: number, size: number) => MemoryRead;
  /** Why a store there would trap, or null when it would go through. */
  storeFault: (address: number, size: number) => string | null;
}

/** What an instruction found when it ran: all a datapath needs to do it again from its lines. */
export interface ControlContext {
  /** Every register the word can name, by its number. */
  registers: readonly number[];
  /** The address of the instruction. */
  here: number;
  /** Whether it was fetched from the program, so the instruction pointer moves on. */
  fetched: Bit;
  memory: ControlMemory;
}

/** What the control unit made of one executed instruction. */
export interface ControlView {
  /** The instruction as the bits the control unit reads. */
  word: number;
  width: number;
  fields: WordField[];
  shape: ControlShape;
  /** How the instruction pointer was loaded when the instruction ended, or null when not shown. */
  pc: PcRequest | null;
  /** Said about the instruction pointer: why it is not shown, or what is unusual about it. */
  pcNote: string | null;
  /** What the instruction found, for following what its control lines make the CPU do. */
  context: ControlContext;
}

/** An instruction with no control unit to show, and why. */
export interface NoControlView {
  unavailable: string;
}

/** Where an executed instruction leads in the control topic. */
export type ControlLink = ControlView | NoControlView;

export function hasControl(link: ControlLink): link is ControlView {
  return 'shape' in link;
}

/** Both decoders with a word on their inputs. */
export interface ControlSolution {
  main: DecoderSolution;
  alu: DecoderSolution;
}

/** The faults that break a line of this decoder. */
function faultsIn({ lines }: DecoderShape, faults: Faults): Faults {
  return Object.fromEntries(
    lines.filter(({ id }) => id in faults).map(({ id }) => [id, faults[id]])
  );
}

/**
 * Runs an instruction word through the two decoders, the second reading the first one's wires.
 * `faults` names the control lines that are broken, each stuck at one value; a line of the first
 * decoder that the second reads carries its fault there. A linker never passes any.
 */
export function solveControl(
  { wires, main, alu }: ControlShape,
  word: number,
  faults: Faults = {}
): ControlSolution {
  const known = [...main.lines, ...alu.lines].map((line) => line.id);
  const unknown = Object.keys(faults).find((name) => !known.includes(name));
  if (unknown !== undefined) throw new Error(`No control line is called ${unknown}.`);
  const fromWord = (name: string): Bit => bitOf(word, wires[name]);
  const first = solveDecoder(
    main,
    Object.fromEntries(main.inputs.map((n) => [n, fromWord(n)])),
    faultsIn(main, faults)
  );
  const second = solveDecoder(
    alu,
    Object.fromEntries(
      alu.inputs.map((name) => [name, name in wires ? fromWord(name) : first.signals[name]])
    ),
    faultsIn(alu, faults)
  );
  return { main: first, alu: second };
}
