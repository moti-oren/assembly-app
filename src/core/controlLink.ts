import { solveDecoder, type DecoderShape, type DecoderSolution } from './logic/decoder';
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

/** Runs an instruction word through the two decoders, the second reading the first one's wires. */
export function solveControl({ wires, main, alu }: ControlShape, word: number): ControlSolution {
  const fromWord = (name: string): Bit => bitOf(word, wires[name]);
  const first = solveDecoder(main, Object.fromEntries(main.inputs.map((n) => [n, fromWord(n)])));
  const second = solveDecoder(
    alu,
    Object.fromEntries(
      alu.inputs.map((name) => [name, name in wires ? fromWord(name) : first.signals[name]])
    )
  );
  return { main: first, alu: second };
}
