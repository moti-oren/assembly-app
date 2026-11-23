/**
 * A record of values kept in storage as JSON, read back without trusting it: storage can hold
 * anything, from an older version of the app or from the user's own hands.
 */

/** The entries of a stored record whose values pass `keep`; anything unreadable is no entry. */
export function readStoredRecord<Value>(
  raw: string,
  keep: (value: unknown) => value is Value
): Record<string, Value> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const kept: Record<string, Value> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (keep(value)) kept[key] = value;
  }
  return kept;
}

export const isStoredText = (value: unknown): value is string => typeof value === 'string';

/** A whole number that counts something: never negative. */
export const isStoredCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;
