/** Where a button sits on screen; a DOMRect has all of these. */
export interface Box {
  left: number;
  top: number;
  width: number;
}

/** Boxes whose tops are this close sit on the same row. */
const SAME_ROW = 1;

/**
 * The index of the box on the next row up or down from box `from`, in the column nearest to it.
 * `from` itself when there is no row that way.
 */
export function rowNeighbour(boxes: readonly Box[], from: number, down: boolean): number {
  const current = boxes[from];
  const centre = current.left + current.width / 2;
  let rowTop: number | null = null;
  for (const { top } of boxes) {
    const beyond = down ? top > current.top + SAME_ROW : top < current.top - SAME_ROW;
    if (beyond && (rowTop === null || (down ? top < rowTop : top > rowTop))) rowTop = top;
  }
  if (rowTop === null) return from;
  let best = from;
  let distance = Infinity;
  boxes.forEach((box, index) => {
    if (Math.abs(box.top - rowTop) > SAME_ROW) return;
    const gap = Math.abs(box.left + box.width / 2 - centre);
    if (gap < distance) {
      distance = gap;
      best = index;
    }
  });
  return best;
}
