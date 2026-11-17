import { truncate } from './numbers';
import type { MemoryBase, Operand } from './operands';
import { MEMORY_SIZE, readRegister, type RegisterFile } from './state';

/** Every step of turning segment:offset into the 20-bit address the bus carries. */
export interface AddressBreakdown {
  segment: number;
  offset: number;
  /** The segment shifted left by 4 bits (segment × 10h). */
  shifted: number;
  /** shifted + offset, before the 20-bit address bus drops the carry. */
  sum: number;
  physical: number;
  /** True when the sum did not fit in 20 bits, so the address wrapped around past 1MB. */
  wrapped: boolean;
}

export function explainAddress(segment: number, offset: number): AddressBreakdown {
  const segment16 = truncate(segment, 16);
  const offset16 = truncate(offset, 16);
  const shifted = segment16 * 0x10;
  const sum = shifted + offset16;
  return {
    segment: segment16,
    offset: offset16,
    shifted,
    sum,
    physical: sum % MEMORY_SIZE,
    wrapped: sum >= MEMORY_SIZE
  };
}

/** How a memory operand's 16-bit offset is formed from its base register and displacement. */
export interface OffsetBreakdown {
  base: MemoryBase | null;
  baseValue: number;
  displacement: number;
  offset: number;
  /** True when base + displacement did not fit in 16 bits, so the offset wrapped inside the segment. */
  wrapped: boolean;
}

export function explainOffset(
  state: RegisterFile,
  operand: Extract<Operand, { type: 'mem' }>
): OffsetBreakdown {
  const baseValue = operand.base ? readRegister(state, operand.base) : 0;
  const displacement = truncate(operand.displacement, 16);
  const sum = baseValue + displacement;
  return {
    base: operand.base,
    baseValue,
    displacement,
    offset: truncate(sum, 16),
    wrapped: sum > 0xffff
  };
}
