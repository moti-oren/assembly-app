import { misread, storedBytes, type ByteOrder } from '@/core/representation/bytes';
import { wrap, type Width } from '@/core/representation/readings';
import { PREFIXED, type HexStyle } from './hexNotation';
import { hexOf } from './logicView';
import { numberText } from './numbersView';

/** The two orders a value's bytes can be stored in. */
export const BYTE_ORDERS = [
  { id: 'little', label: 'Low byte first' },
  { id: 'big', label: 'High byte first' }
] as const;

/** One byte of a value, where it sits in memory. */
export interface ByteCell {
  /** Where the byte is, counted from the value's own address: `n`, `n + 1`. */
  address: string;
  /** The byte as two hex digits. */
  hex: string;
  /** The bits of the value it holds: `bits 15–8`. */
  bits: string;
  /** True for the byte that holds bit 0. */
  low: boolean;
}

/** The value's bytes in the order they sit in memory, the lowest address first. */
export function byteCells(value: number, width: Width, order: ByteOrder): ByteCell[] {
  const bytes = storedBytes(wrap(value, width), width, order);
  return bytes.map((byte, index) => {
    // Counted from the low end of the value, whichever end is stored first.
    const place = order === 'little' ? index : bytes.length - 1 - index;
    return {
      address: index === 0 ? 'n' : `n + ${index}`,
      hex: byte.toString(16).toUpperCase().padStart(2, '0'),
      bits: `bits ${place * 8 + 7}–${place * 8}`,
      low: place === 0
    };
  });
}

/** What the order on show is, and which of the CPUs here use it. */
export function orderLesson(order: ByteOrder): string {
  return order === 'little'
    ? 'The 8086 and RISC-V store a value this way, little end first, and the 6502 keeps its 16-bit addresses the same way: the low byte is at the lowest address, whatever the width.'
    : 'Big end first is the order a number is written in, and the order most network protocols send one in. None of the three CPUs here stores a value this way.';
}

/** What becomes of a stored value when a program reads its bytes in the other order. */
export function misreadText(value: number, width: Width, style: HexStyle = PREFIXED): string {
  const bits = wrap(value, width);
  const other = misread(bits, width);
  return other === bits
    ? 'These bytes read the same in either order.'
    : `Read in the other order, the same bytes are ${hexOf(other, width, style)}: ${numberText(other)} and not ${numberText(bits)}.`;
}
