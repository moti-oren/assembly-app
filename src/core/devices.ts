/**
 * The devices wired to the I/O ports. OUT latches a byte into an output port and IN reads the
 * byte a device presents on an input port; the two directions are separate, as on real hardware.
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
export const SEGMENTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const;
export type Segment = (typeof SEGMENTS)[number];

/** The byte that shows each hex digit on a 7-segment display. */
export const SEGMENT_PATTERNS: readonly number[] = [
  0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71
];

export function litSegments(value: number): Segment[] {
  return SEGMENTS.filter((_, bit) => (value & (1 << bit)) !== 0);
}

/** What the terminal shows for the bytes written to it: printable ASCII, and line feeds. */
export function terminalText(bytes: readonly number[]): string {
  return bytes
    .map((byte) => {
      if (byte === 0x0a) return '\n';
      if (byte === 0x0d) return '';
      return byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '·';
    })
    .join('');
}
