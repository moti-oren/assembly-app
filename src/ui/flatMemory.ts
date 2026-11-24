import { PORTS } from '@/core/shared/devices';
import type { IoState } from '@/core/shared/state';
import { rowStart, type MemoryColumns } from './memoryColumns';

/**
 * Memory as one flat space of addresses, the way RISC-V and the 6502 see it: no segments, just
 * the code, RAM and the devices at their places in it.
 */

/** What sits at an address. */
export type ByteRegion = 'code' | 'ram' | 'device';

/** One byte as the memory panel shows it; null where nothing is wired. */
export interface ShownByte {
  address: number;
  value: number | null;
  region: ByteRegion | null;
}

export type ByteAt = (address: number) => ShownByte;

/** A place the memory panel jumps to. A stack place shows the top of the stack at the bottom. */
export interface MemoryPlace {
  label: string;
  start: () => number;
  stack?: boolean;
}

/** How addresses are written: 32-bit RISC-V ones as 0x00010000, 16-bit 6502 ones as $0200. */
export interface AddressFormat {
  prefix: string;
  digits: number;
}

export function formatAddress(format: AddressFormat, address: number): string {
  return `${format.prefix}${address.toString(16).toUpperCase().padStart(format.digits, '0')}`;
}

/** The switches are an input: a device byte shows what they present, the others what was written. */
export function deviceByte(io: IoState, port: number): number {
  return port === PORTS.switches ? io.in[port] : io.out[port];
}

/** How many addresses a format can write: 64K for the 6502's four digits, 4G for RISC-V's eight. */
export function addressSpace(format: AddressFormat): number {
  return 16 ** format.digits;
}

/**
 * `count` rows of `columns` bytes, from `start` rounded down to a row. Near the end of the
 * address space (`space`), the rows stop at its last byte rather than run past it.
 */
export function memoryRows(
  byteAt: ByteAt,
  start: number,
  count: number,
  columns: MemoryColumns = 16,
  space = Infinity
): ShownByte[][] {
  const first = Math.max(0, Math.min(rowStart(start, columns), space - count * columns));
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: columns }, (_, column) => byteAt(first + columns * row + column))
  );
}
