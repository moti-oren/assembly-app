import { PORTS } from './devices';
import type { Size } from './numbers';

/**
 * Device registers, each one byte wide. The 8086 reaches them with IN and OUT, through a
 * 64K port space of its own; an architecture without I/O instructions maps them into memory.
 */
const PORT_COUNT = 0x10000;

export interface IoState {
  /** The last byte written to each port. */
  out: Uint8Array;
  /** The byte each port presents to a read; devices such as the switches set it. */
  in: Uint8Array;
  /** Every byte written to the terminal port, in order. */
  terminal: number[];
}

/** What every CPU has, whatever its architecture. Each architecture names its own registers. */
export interface CpuState<Register extends string = string> {
  /** The single source of truth for every register, by name. */
  registers: Record<Register, number>;
  /** The flags register, or 0 on an architecture that has none. */
  flags: number;
  memory: Uint8Array;
  /** Bumped on every memory write so UI frameworks can track changes to `memory`. */
  memoryVersion: number;
  io: IoState;
  /** Bumped on every port change, for the same reason as `memoryVersion`. */
  ioVersion: number;
}

/** The registers and flags at one moment; memory and ports are tracked as writes instead. */
export interface CpuSnapshot<Register extends string = string> {
  registers: Record<Register, number>;
  flags: number;
}

export interface MemoryWrite {
  address: number;
  before: number;
  after: number;
}

/** One byte written to an output port. */
export interface PortWrite {
  port: number;
  before: number;
  after: number;
}

export function snapshot<Register extends string>(
  state: CpuState<Register>
): CpuSnapshot<Register> {
  return { registers: { ...state.registers }, flags: state.flags };
}

export function createIo(): IoState {
  return { out: new Uint8Array(PORT_COUNT), in: new Uint8Array(PORT_COUNT), terminal: [] };
}

/** Little-endian read of a byte or a word; addresses wrap around at the end of memory. */
export function readMemory(state: CpuState, address: number, size: Size): number {
  return readBytes(state, address, size / 8).reduce(
    (value, byte, i) => value | (byte << (8 * i)),
    0
  );
}

/** Little-endian write of a byte or a word. Returns what changed, for undo and highlighting. */
export function writeMemory(
  state: CpuState,
  address: number,
  size: Size,
  value: number
): MemoryWrite[] {
  const bytes = size === 8 ? [value & 0xff] : [value & 0xff, (value >> 8) & 0xff];
  return writeBytes(state, address, bytes);
}

/** `count` bytes from `address` up, wrapping around at the end of memory. */
export function readBytes(state: CpuState, address: number, count: number): number[] {
  const { memory } = state;
  return Array.from({ length: count }, (_, i) => memory[(address + i) % memory.length]);
}

/** Writes bytes from `address` up. Returns what changed, for undo and highlighting. */
export function writeBytes(
  state: CpuState,
  address: number,
  bytes: readonly number[]
): MemoryWrite[] {
  const { memory } = state;
  const writes = bytes.map((value, i) => {
    const target = (address + i) % memory.length;
    const before = memory[target];
    const after = value & 0xff;
    memory[target] = after;
    return { address: target, before, after };
  });
  state.memoryVersion++;
  return writes;
}

/** The byte a device presents on an input port. Ports with no device read as 0. */
export function readPort(state: CpuState, port: number): number {
  return state.io.in[port % PORT_COUNT];
}

/** Sets what an input port presents, e.g. when a switch is flipped. Not an instruction: no undo. */
export function setInputPort(state: CpuState, port: number, value: number): void {
  state.io.in[port % PORT_COUNT] = value;
  state.ioVersion++;
}

/** Latches a byte into an output port. Returns what changed, for undo. */
export function writePort(state: CpuState, port: number, value: number): PortWrite {
  const target = port % PORT_COUNT;
  const write = { port: target, before: state.io.out[target], after: value & 0xff };
  redoPortWrite(state, write);
  return write;
}

export function redoPortWrite(state: CpuState, write: PortWrite): void {
  state.io.out[write.port] = write.after;
  if (write.port === PORTS.terminal) state.io.terminal.push(write.after);
  state.ioVersion++;
}

export function undoPortWrite(state: CpuState, write: PortWrite): void {
  state.io.out[write.port] = write.before;
  if (write.port === PORTS.terminal) state.io.terminal.pop();
  state.ioVersion++;
}
