import { formatLabel } from '@/core/shared/program';

/**
 * The rules of a program whose first lines are locked: a challenge's given lines, which are not
 * the user's to change. `locked` is how many there are, counted from L0.
 */

/** Whether a line can be edited, replaced or removed. */
export function canChange(index: number, locked: number): boolean {
  return index >= locked;
}

/** Whether a line can go from `from` to `to`: neither a locked line nor a place among them. */
export function canMove(from: number, to: number, locked: number): boolean {
  return from >= locked && to >= locked;
}

/** Why a move that `canMove` refuses is refused, in words. */
export function moveRefusal(from: number, locked: number): string {
  return from < locked
    ? `${formatLabel(from)} is given by the challenge: it stays where it is`
    : `${formatLabel(from)} cannot move in among the lines the challenge gives`;
}

/**
 * Where new lines go when they were asked for before line `insertAt` (null: at the end): never
 * above a locked line, since that would push the locked lines down.
 */
export function insertionAfterLock(insertAt: number | null, locked: number): number | null {
  return insertAt !== null && insertAt < locked ? locked : insertAt;
}
