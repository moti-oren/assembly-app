import { bitOf, type Bit } from '@/core/logic/gates';
import { allBits, heldAt, type ClockPhase } from '@/core/logic/register';
import {
  addressWidth,
  type RegisterFileRequest,
  type RegisterFileSolution
} from '@/core/logic/registerFile';
import { written, type RegisterFileView, type RegisterWrite } from '@/core/registerLink';
import { PREFIXED, type HexStyle } from './hexNotation';
import { hexOf } from './logicView';

/** A file no CPU gave: eight registers of eight bits, to work by hand. */
export const FREE_FILE: RegisterFileView = {
  names: ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'],
  request: {
    width: 8,
    held: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77],
    input: 0xa5,
    address: 5,
    write: 1,
    zeroWired: false
  }
};

export function withAddressBitFlipped(
  request: RegisterFileRequest,
  bit: number
): RegisterFileRequest {
  return { ...request, address: request.address ^ (1 << bit) };
}

export function withWriteFlipped(request: RegisterFileRequest): RegisterFileRequest {
  return { ...request, write: request.write ? 0 : 1 };
}

/** The address as the wires that carry it, bit 0 first. */
export function addressBits({ held, address }: RegisterFileRequest): Bit[] {
  return Array.from({ length: addressWidth(held.length) }, (_, bit) => bitOf(address, bit));
}

/** An address as it is written, the top bit first: `01010`. */
function addressText(index: number, count: number): string {
  return index.toString(2).padStart(addressWidth(count), '0');
}

/** One register of the file, as the panel lists it. */
export interface FileRow {
  index: number;
  name: string;
  /** Its address in binary, the top bit first. */
  address: string;
  /** What it holds at this moment of the clock cycle. */
  value: string;
  load: Bit;
  /** Whether it has no flip-flops: it reads as 0 whatever is written to it. */
  wired: boolean;
  /** Whether it has taken the input by now. */
  written: boolean;
  /** How its value is drawn: `changed` for a write the CPU made, `strong` for one made by hand. */
  tone: 'changed' | 'strong' | 'plain';
  /** What a screen reader hears for it. */
  label: string;
}

/** Every register of the file at a moment of the clock cycle. */
export function fileRows(
  { names }: RegisterFileView,
  solution: RegisterFileSolution,
  phase: ClockPhase,
  /** Whether the file is the CPU's as it ran: colour marks a write, and only a real one. */
  asRun = false,
  style: HexStyle = PREFIXED
): FileRow[] {
  const { width, held } = solution.request;
  return solution.registers.map((register, index) => {
    const value = hexOf(register ? heldAt(register, phase) : 0, width, style);
    const load = solution.loads[index];
    const written = load === 1 && phase !== 'before';
    const state = register ? (load ? 'load line 1' : 'load line 0') : 'wired to 0, no flip-flops';
    return {
      index,
      name: names[index],
      address: addressText(index, held.length),
      value,
      load,
      wired: register === null,
      written,
      tone: written ? (asRun ? 'changed' : 'strong') : 'plain',
      label: `${names[index]}, address ${addressText(index, held.length)}: ${value}, ${state}`
    };
  });
}

/** The file's size as a heading: `32 registers of 32 bits`. */
export function fileTitle({ held, width }: RegisterFileRequest): string {
  return `${held.length} registers of ${width} bits`;
}

/** What the decoder made of the address and the write line. */
export function decoderText({ names }: RegisterFileView, solution: RegisterFileSolution): string {
  const { address, write, held } = solution.request;
  const name = names[address];
  const at = `Address ${addressText(address, held.length)} is ${name}`;
  if (!write) return `${at}, but the write line is 0: no load line is on, and no register changes.`;
  if (solution.registers[address] === null) {
    return `${at}, which has no flip-flops and no gate in the decoder: no load line is on, and the value is lost.`;
  }
  return `${at}: its load line is the only one on, so the clock writes ${name} and no other register.`;
}

/** What is going on at each moment of the file's clock cycle. */
export function filePhaseText(solution: RegisterFileSolution, phase: ClockPhase): string {
  const loaded = solution.loads.includes(1);
  if (phase === 'before') {
    return 'The clock is low. The same value waits at the inputs of every register.';
  }
  if (!loaded) return 'The clock rose, and every register kept what it held.';
  return phase === 'high'
    ? 'The clock has risen: the one register whose load line is on took the value. The others saw the same clock, and kept theirs.'
    : 'The clock is low again, and the register keeps the new value.';
}

/** One register of the file as the cycle of its own flip-flops, or null for one that has none. */
export function registerOf(
  { names }: RegisterFileView,
  solution: RegisterFileSolution,
  index: number
): RegisterWrite | null {
  if (solution.registers[index] === null) return null;
  const { width, held, input } = solution.request;
  const enabled = solution.loads[index] ? allBits(width) : 0;
  return written(names[index], width, held[index], input, enabled);
}
