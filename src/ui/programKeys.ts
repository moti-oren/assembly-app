/** A line of the program going to another place. */
export interface LineMove {
  from: number;
  to: number;
}

/**
 * Where Alt with Up or Down takes line `from` of a program `length` lines long, or null when
 * the key is another one or the line is already at that end.
 */
export function lineMoveOf(
  event: Pick<KeyboardEvent, 'key' | 'altKey'>,
  from: number,
  length: number
): LineMove | null {
  if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return null;
  if (!Number.isInteger(from) || from < 0 || from >= length) return null;
  const to = from + (event.key === 'ArrowUp' ? -1 : 1);
  return to < 0 || to >= length ? null : { from, to };
}

/**
 * The line whose controls take the focus once line `index` is removed from a program that now has
 * `length` lines: the one that took its place, or the line above when it was the last. Null when
 * no line is left.
 */
export function rowAfterRemove(index: number, length: number): number | null {
  return length === 0 ? null : Math.min(index, length - 1);
}
