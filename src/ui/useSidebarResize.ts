import { onBeforeUnmount } from 'vue';
import { resizePair, type SidebarKey } from './sidebarLayout';
import { useSidebarLayout } from './useSidebarLayout';

/** How far an arrow key moves the line between two panels. */
const KEY_STEP = 16;

interface Drag {
  pointerId: number;
  startY: number;
  above: SidebarKey;
  below: SidebarKey;
  heights: Map<SidebarKey, number>;
}

/**
 * Moving the line between two open sidebar panels, by dragging it or with the arrow keys.
 * Every open panel is given the height it is drawn at, so only the two panels on either side
 * of the line change, and nothing else in the pane shifts.
 */
export function useSidebarResize(
  height: (key: SidebarKey) => number,
  programRows: () => number = () => 0
) {
  const layout = useSidebarLayout();
  let drag: Drag | null = null;

  function measure(open: readonly SidebarKey[]): Map<SidebarKey, number> {
    return new Map(open.map((key) => [key, height(key)] as const));
  }

  function apply(
    heights: Map<SidebarKey, number>,
    above: SidebarKey,
    below: SidebarKey,
    dy: number
  ) {
    const [up, down] = resizePair(
      { key: above, height: heights.get(above) ?? 0 },
      { key: below, height: heights.get(below) ?? 0 },
      dy,
      programRows()
    );
    layout.setSizes({ ...Object.fromEntries(heights), [above]: up, [below]: down });
  }

  function onMove(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    apply(drag.heights, drag.above, drag.below, event.clientY - drag.startY);
  }

  function stop(): void {
    drag = null;
    document.documentElement.classList.remove('resizing');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
  }

  function start(
    event: PointerEvent,
    open: readonly SidebarKey[],
    above: SidebarKey,
    below: SidebarKey
  ): void {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    const heights = measure(open);
    drag = { pointerId: event.pointerId, startY: event.clientY, above, below, heights };
    document.documentElement.classList.add('resizing');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function onKey(
    event: KeyboardEvent,
    open: readonly SidebarKey[],
    above: SidebarKey,
    below: SidebarKey
  ): void {
    const dy = event.key === 'ArrowUp' ? -KEY_STEP : event.key === 'ArrowDown' ? KEY_STEP : 0;
    if (dy === 0) return;
    event.preventDefault();
    apply(measure(open), above, below, dy);
  }

  onBeforeUnmount(stop);

  return { start, onKey };
}
