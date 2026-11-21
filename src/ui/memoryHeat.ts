/** How many instructions back a memory write still shows as warm. */
export const HEAT_STEPS = 6;

/**
 * The background of a byte written `heat.get(address)` instructions ago: a write cools down over
 * the next few instructions instead of vanishing at once. The last instruction's own writes (age
 * 0) are marked by their panel instead, so they get none.
 */
export function warmth(heat: ReadonlyMap<number, number>, address: number): string | undefined {
  const age = heat.get(address);
  if (!age) return undefined;
  const strength = Math.round((1 - age / HEAT_STEPS) * 70);
  return `color-mix(in oklch, var(--changed) ${strength}%, transparent)`;
}
