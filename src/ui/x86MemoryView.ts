import {
  explainAddress,
  formatPhysical,
  type AddressBreakdown,
  type OffsetBreakdown
} from '@/core/x86/address';
import { formatHex } from '@/core/shared/numbers';
import type { SegmentRegister } from '@/core/x86/registers';
import { physicalAddress, type CpuState } from '@/core/x86/state';
import type { MemoryAccess } from './describe';

/** One row of the 8086 memory panel: its offset in the segment, and its bytes. */
export interface SegmentRow {
  offset: number;
  bytes: { address: number; value: number }[];
}

/** `count` rows of `columns` bytes from `start` in the segment at `segment`, wrapping at 64K. */
export function segmentRows(
  state: Pick<CpuState, 'memory'>,
  segment: number,
  start: number,
  count: number,
  columns: number
): SegmentRow[] {
  return Array.from({ length: count }, (_, row) => {
    const offset = (start + row * columns) & 0xffff;
    const bytes = Array.from({ length: columns }, (_, column) => {
      const address = physicalAddress(segment, offset + column);
      return { address, value: state.memory[address] };
    });
    return { offset, bytes };
  });
}

/** An address the panel works out, segment:offset to physical. */
export interface WorkedAddress {
  label: string;
  segment: SegmentRegister;
  sum: AddressBreakdown;
  offsetParts: OffsetBreakdown | null;
  isLastAccess: boolean;
  /** The physical address's colour: orange for a write, blue for a read, none for a byte pointed at. */
  tone: 'plain' | 'write' | 'read';
}

/** The address to work out: the byte under the pointer, or else the last instruction's access. */
export function workedAddress(
  pointed: { segment: SegmentRegister; segmentValue: number; offset: number } | null,
  access: MemoryAccess | null
): WorkedAddress | null {
  if (pointed) {
    return {
      label: 'This byte',
      segment: pointed.segment,
      sum: explainAddress(pointed.segmentValue, pointed.offset),
      offsetParts: null,
      isLastAccess: false,
      tone: 'plain'
    };
  }
  if (!access) return null;
  return {
    label: access.bytes
      ? `Last write, ${access.bytes} bytes from`
      : access.write
        ? 'Last write'
        : 'Last read',
    segment: access.segment,
    sum: explainAddress(access.segmentValue, access.offset),
    offsetParts: access.offsetParts,
    isLastAccess: true,
    tone: access.write ? 'write' : 'read'
  };
}

/** Where the offset came from, when a register supplied it. */
export function offsetNote(parts: OffsetBreakdown | null): string | null {
  if (!parts?.base) return null;
  const base = parts.base.toUpperCase();
  if (parts.displacement === 0) return `offset = ${base}`;
  const sum = `offset = ${base} ${formatHex(parts.baseValue, 16)}h + ${formatHex(parts.displacement, 16)}h`;
  return parts.wrapped ? `${sum}, wraps at 64K` : sum;
}

/**
 * A byte of the table as a screen reader hears it: its offset, the physical address it is at,
 * its value, and whether the last instruction wrote it, which the table shows only by colour.
 */
export function byteLabel(
  offset: number,
  physical: number,
  value: number,
  written: { unchanged: boolean } | null
): string {
  const at = `${formatHex(offset, 16)}, physical ${formatPhysical(physical)}h`;
  const state = written
    ? written.unchanged
      ? ', written by the last instruction with the value it held'
      : ', written by the last instruction'
    : '';
  return `${at}: ${formatHex(value, 8)}${state}`;
}
