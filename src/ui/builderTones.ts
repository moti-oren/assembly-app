/** The colour family a group of builder choices is shown in. */
export type Tone = 'transfer' | 'arithmetic' | 'logic' | 'shift' | 'control' | 'stack' | 'system';

/**
 * What marks a group's name as one family, the first match winning. The three architectures name
 * their groups differently ("Data transfer", "Load & store", "Load from memory"), so the names
 * are matched by the words they share rather than listed one by one.
 */
const FAMILIES: readonly [RegExp, Tone][] = [
  [/stack/i, 'stack'],
  [/shift|rotate/i, 'shift'],
  [/logic/i, 'logic'],
  [/jump|branch|call/i, 'control'],
  [/arithmetic|compare|multiply|upper/i, 'arithmetic'],
  [/transfer|load|store|string|input/i, 'transfer'],
  [/interrupt|flag|prefix|pseudo/i, 'system']
];

/**
 * The family of a group of choices, by its name. Groups of operands (registers, immediates,
 * addresses) belong to none and stay neutral: null.
 */
export function groupTone(group: string): Tone | null {
  return FAMILIES.find(([pattern]) => pattern.test(group))?.[1] ?? null;
}
