/**
 * A stored order made safe to use: unknown or repeated keys are dropped, and keys it lacks
 * (a card added since it was saved) are appended in their default place order.
 */
export function sanitizeOrder<K extends string>(stored: unknown, defaults: readonly K[]): K[] {
  const known = new Set<string>(defaults);
  const kept = Array.isArray(stored)
    ? stored.filter((key): key is K => typeof key === 'string' && known.has(key))
    : [];
  const unique = [...new Set(kept)];
  return [...unique, ...defaults.filter((key) => !unique.includes(key))];
}

/** `keys` with `key` taken out and put back at index `to`. */
export function withMoved<K>(keys: readonly K[], key: K, to: number): K[] {
  const order = keys.filter((item) => item !== key);
  order.splice(to, 0, key);
  return order;
}

/** The place a key on a card's grip moves the card to, from `index` among `count`; null for other keys. */
export function keyTarget(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowUp':
      return index - 1;
    case 'ArrowDown':
      return index + 1;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * Moves `key` so that it becomes visible card number `to` (0-based) among `visible`. Hidden
 * cards keep their places in the full order, so they come back where they were.
 */
export function moveAmongVisible<K>(
  order: readonly K[],
  visible: readonly K[],
  key: K,
  to: number
): K[] {
  const rest = order.filter((item) => item !== key);
  const visibleRest = visible.filter((item) => item !== key);
  const before = visibleRest[to];
  let index: number;
  if (before !== undefined) {
    index = rest.indexOf(before);
  } else {
    // Last among the visible cards: right after the one that was last.
    const last = visibleRest.at(-1);
    index = last === undefined ? rest.length : rest.indexOf(last) + 1;
  }
  return [...rest.slice(0, index), key, ...rest.slice(index)];
}

/** Where a card sits in its column, in page pixels, measured when a drag begins. */
export interface Slot {
  top: number;
  height: number;
}

/**
 * How far the dragged card's leading edge has to reach into a neighbour to take its place:
 * a short way into a tall card, so a drag never needs more than a small move; half of a
 * short one, so the swap does not happen the moment the edges touch.
 */
export const SWAP_DISTANCE = 48;

function reach(slot: Slot): number {
  return Math.min(slot.height / 2, SWAP_DISTANCE);
}

/**
 * The place the card at `home` would drop into after moving `dy` pixels. It is worked out from
 * where every card was when the drag began, so the answer depends only on `dy`: the cards that
 * slide aside never feed back into it, and nothing flickers back and forth.
 */
export function dragTarget(slots: readonly Slot[], home: number, dy: number): number {
  const top = slots[home].top + dy;
  const bottom = top + slots[home].height;
  let target = home;
  if (dy > 0) {
    for (let index = home + 1; index < slots.length; index++) {
      if (bottom <= slots[index].top + reach(slots[index])) break;
      target = index;
    }
  } else if (dy < 0) {
    for (let index = home - 1; index >= 0; index--) {
      const slot = slots[index];
      if (top >= slot.top + slot.height - reach(slot)) break;
      target = index;
    }
  }
  return target;
}

/** How far card `index` slides to make room while the card at `home` hovers over `target`. */
export function shiftFor(
  slots: readonly Slot[],
  home: number,
  target: number,
  index: number,
  gap: number
): number {
  const room = slots[home].height + gap;
  if (index > home && index <= target) return -room;
  if (index < home && index >= target) return room;
  return 0;
}

/** How far the dragged card is from its starting place once it settles at `target`. */
export function settleOffset(
  slots: readonly Slot[],
  home: number,
  target: number,
  gap: number
): number {
  let offset = 0;
  for (let index = home + 1; index <= target; index++) offset += slots[index].height + gap;
  for (let index = target; index < home; index++) offset -= slots[index].height + gap;
  return offset;
}
