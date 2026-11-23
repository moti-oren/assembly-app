import { field, signExtend } from './bits';
import { IMMEDIATE_PIECES } from './encode';
import type { Format } from './instructions';

/** A format that carries an immediate: every one but R. */
export type ImmediateFormat = Exclude<Format, 'R'>;

/**
 * The immediate a 32-bit instruction word carries, read as `format` says: its pieces put back in
 * their places and the top bit copied upward. A branch's and JAL's is the distance in bytes;
 * LUI's and AUIPC's is already shifted up.
 */
export function immediateOf(word: number, format: ImmediateFormat): number {
  const pieces = IMMEDIATE_PIECES[format];
  const value = pieces.reduce(
    (bits, { high, low, to }) => bits | (field(word, high, low) << to),
    0
  );
  const top = Math.max(...pieces.map((piece) => piece.from));
  return signExtend(value, top + 1);
}
