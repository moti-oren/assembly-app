/**
 * The notes of a ModR/M byte start with the bits they explain, which the panel shows in a column
 * of their own. Without them the note is what that column's value means.
 */
export function withoutModBits(note: string): string {
  return note.replace(/^[01]+(:| with)\s*/, '');
}

/** `001 = CX` without the `001 = `. */
export function withoutBits(note: string): string {
  return note.replace(/^[01]+ = /, '');
}
