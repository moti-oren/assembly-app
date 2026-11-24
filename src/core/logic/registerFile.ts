import type { Width } from './alu';
import { solveDecoder, type DecoderShape, type DecoderSolution, type DecoderTerm } from './decoder';
import { bitOf, type Bit } from './gates';
import { allBits, solveRegister, type RegisterSolution } from './register';

/** The names of a register file's own wires; each register's are those of `REGISTER`. */
export const FILE = {
  /** A bit of the address of the register to write. */
  address: (bit: number) => `a${bit}`,
  /** 1 when the instruction writes a register at all. */
  write: 'we',
  /** 1 for the one register that takes the input at the next clock edge. */
  load: (index: number) => `load${index}`
};

/** One clock cycle of a file of registers that share an input: which one is written, if any. */
export interface RegisterFileRequest {
  width: Width;
  /** What every register holds, by its address; there is a power of two of them. */
  held: readonly number[];
  input: number;
  address: number;
  write: Bit;
  /** Whether the register at address 0 has no flip-flops, and reads as 0 whatever is written. */
  zeroWired: boolean;
}

/** How many bits an address of one of `count` registers takes. */
export function addressWidth(count: number): number {
  const bits = Math.log2(count);
  if (count < 2 || !Number.isInteger(bits)) {
    throw new Error(`A register file holds a power of two of registers, not ${count}.`);
  }
  return bits;
}

/**
 * The decoder that turns an address into load lines: an AND gate per register, on when the
 * address is its own and a write is asked for. A register wired to 0 has no gate.
 */
export function addressDecoder(count: number, zeroWired: boolean): DecoderShape {
  const bits = Array.from({ length: addressWidth(count) }, (_, bit) => bit);
  const term = (index: number): DecoderTerm => ({
    id: FILE.load(index),
    match: {
      ...Object.fromEntries(bits.map((bit) => [FILE.address(bit), bitOf(index, bit)])),
      [FILE.write]: 1
    }
  });
  const indexes = Array.from({ length: count }, (_, index) => index);
  return {
    inputs: [...bits.map(FILE.address), FILE.write],
    terms: indexes.filter((index) => !(zeroWired && index === 0)).map(term),
    lines: []
  };
}

/** A register file taken through one clock cycle. */
export interface RegisterFileSolution {
  request: RegisterFileRequest;
  decoder: DecoderSolution;
  /** The load line of every register; a register wired to 0 has none, which reads as 0 here. */
  loads: Bit[];
  /** Every register through the cycle, or null for the one that has no flip-flops. */
  registers: (RegisterSolution | null)[];
  /** What every register holds once the cycle is over. */
  stored: number[];
}

/**
 * Runs the address through the decoder, then clocks every register with its load line on all its
 * write lines. It is put together from solved parts, since the registers' wires share names.
 */
export function solveRegisterFile(request: RegisterFileRequest): RegisterFileSolution {
  const { width, held, input, address, write, zeroWired } = request;
  const shape = addressDecoder(held.length, zeroWired);
  const inputs: Record<string, Bit> = { [FILE.write]: write };
  for (let bit = 0; bit < addressWidth(held.length); bit++) {
    inputs[FILE.address(bit)] = bitOf(address, bit);
  }
  const decoder = solveDecoder(shape, inputs);
  const loads = held.map((_, index): Bit => decoder.signals[FILE.load(index)] ?? 0);
  // Registers that hold the same value and are loaded alike go through the same cycle, wire for
  // wire, so each such cycle is worked out once: most registers of a CPU hold 0.
  const cycles = new Map<string, RegisterSolution>();
  const cycle = (value: number, load: Bit): RegisterSolution => {
    const key = `${value}:${load}`;
    const known = cycles.get(key);
    if (known) return known;
    const solved = solveRegister({ width, held: value, input, enabled: load ? allBits(width) : 0 });
    cycles.set(key, solved);
    return solved;
  };
  const registers = held.map((value, index) =>
    zeroWired && index === 0 ? null : cycle(value, loads[index])
  );
  return {
    request,
    decoder,
    loads,
    registers,
    stored: registers.map((solution) => solution?.stored ?? 0)
  };
}
