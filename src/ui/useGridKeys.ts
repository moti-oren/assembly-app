import { computed, nextTick, ref, type Ref } from 'vue';
import { gridMove } from './gridMove';

/** What the grid points at: a cell by its row and column among those on show, or nothing. */
interface GridPointing {
  point: (row: number, column: number) => void;
  unpoint: () => void;
}

/**
 * Cells laid out as a grid for the keyboard (the memory panel's bytes, a list of registers): one stop for Tab, the arrows, Home and
 * End to move, and the cell with the focus pointed at as the mouse points at one. Cells carry
 * `data-cell` with their place, so the focus can follow a move.
 */
export function useGridKeys(
  well: Readonly<Ref<HTMLElement | null>>,
  size: () => { rows: number; columns: number },
  pointing: GridPointing
) {
  /** The byte the keyboard is on, by its place among those on show. */
  const cursor = ref(0);
  const stop = computed(() => {
    const { rows, columns } = size();
    return Math.min(cursor.value, rows * columns - 1);
  });

  function onKey(event: KeyboardEvent): void {
    const { rows, columns } = size();
    const next = gridMove(event.key, stop.value, columns, rows);
    if (next === null) return;
    event.preventDefault();
    cursor.value = next;
    void nextTick(() => well.value?.querySelector<HTMLElement>(`[data-cell="${next}"]`)?.focus());
  }

  function onCellFocus(row: number, column: number): void {
    cursor.value = row * size().columns + column;
    pointing.point(row, column);
  }

  /** Leaving the grid, by mouse or keyboard, points at nothing again, unless the other stays. */
  function onLeave(event: FocusEvent | MouseEvent): void {
    const grid = event.currentTarget as HTMLElement;
    if (event instanceof FocusEvent && grid.contains(event.relatedTarget as Node | null)) return;
    if (event instanceof MouseEvent && grid.contains(document.activeElement)) return;
    pointing.unpoint();
  }

  return { stop, onKey, onCellFocus, onLeave };
}
