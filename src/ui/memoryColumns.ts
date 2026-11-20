/** How many bytes a row of the memory panel holds. */
export type MemoryColumns = 8 | 16;

/** The rows on show: one 256-byte page when a row holds sixteen bytes. */
export const MEMORY_ROWS = 16;

/** The least room, in pixels, a row of sixteen bytes and their text needs, addresses included. */
const WIDE_FROM = 600;

/** A row holds sixteen bytes where they fit, and eight on a narrow screen, rather than scroll. */
export function memoryColumns(width: number): MemoryColumns {
  return width >= WIDE_FROM ? 16 : 8;
}

/** The address of the row that holds `address`. */
export function rowStart(address: number, columns: MemoryColumns): number {
  return address - (address % columns);
}

/** Where a column starts a new group of four, or of eight, and so stands apart from the last. */
export function columnGap(column: number): 'wide' | 'narrow' | null {
  if (column === 0) return null;
  if (column % 8 === 0) return 'wide';
  return column % 4 === 0 ? 'narrow' : null;
}
