/**
 * The bytes on show as a grid the arrow keys walk through: one stop for Tab, and the arrows,
 * Home and End to move between bytes, as a mouse moves between them by pointing.
 */

/** Where a key moves the cell at place `at`, among `rows` rows of `columns`; null if not a move. */
export function gridMove(key: string, at: number, columns: number, rows: number): number | null {
  const column = at % columns;
  const last = rows * columns - 1;
  const step: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -columns,
    ArrowDown: columns,
    Home: -column,
    End: columns - 1 - column
  };
  if (!(key in step)) return null;
  return Math.min(last, Math.max(0, at + step[key]));
}
