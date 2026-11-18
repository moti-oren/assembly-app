/**
 * The devices wired to the I/O ports. Writing latches a byte into an output port and reading
 * gets the byte a device presents on an input port; the two directions are separate, as on real
 * hardware. The 8086 reaches the ports with OUT and IN; an architecture without I/O instructions
 * maps them into memory, at the same numbers from a base address up.
 */
export const PORTS = {
  /** Output: eight LEDs, one per bit. */
  leds: 0x10,
  /** Input: eight switches, one per bit. */
  switches: 0x11,
  /** Output: two 7-segment digits, the left one first. Each bit lights one segment. */
  digits: 0x12,
  /** Output: every byte written is printed as a character. */
  terminal: 0x20
} as const;

export const DIGIT_COUNT = 2;

/** Bit order of a 7-segment digit: a is the top bar, then clockwise, g the middle, dp the dot. */
const SEGMENTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const;
export type Segment = (typeof SEGMENTS)[number];

export function litSegments(value: number): Segment[] {
  return SEGMENTS.filter((_, bit) => (value & (1 << bit)) !== 0);
}

/** A byte as a character on screen: printable ASCII as itself, anything else as a dot. */
export function printable(byte: number): string {
  return byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '·';
}

/** What the terminal shows for the bytes written to it: printable ASCII, and line feeds. */
export function terminalText(bytes: readonly number[]): string {
  return bytes
    .map((byte) => {
      if (byte === 0x0a) return '\n';
      if (byte === 0x0d) return '';
      return printable(byte);
    })
    .join('');
}
