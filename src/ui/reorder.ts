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
