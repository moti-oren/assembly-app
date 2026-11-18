import { PORTS } from '@/core/shared/devices';
import type { IoState } from '@/core/shared/state';

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

/** `count` rows of 16 bytes, from `start` rounded down to a row. */
export function memoryRows(byteAt: ByteAt, start: number, count: number): ShownByte[][] {
  const first = Math.floor(start / 16) * 16;
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: 16 }, (_, column) => byteAt(first + 16 * row + column))
  );
}
