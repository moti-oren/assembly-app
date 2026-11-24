/** Which end of a value sits at the lowest address: its low byte, or its high one. */
export type ByteOrder = 'little' | 'big';

/** The bytes of a row of bits as it is written: the high byte first. */
export function bytesOf(bits: number, width: number): number[] {
  const bytes: number[] = [];
  for (let shift = width - 8; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(bits / 2 ** shift) % 0x100);
  }
  return bytes;
}

/** The bytes as they sit in memory, the lowest address first. */
export function storedBytes(bits: number, width: number, order: ByteOrder): number[] {
  const written = bytesOf(bits, width);
  return order === 'big' ? written : written.reverse();
}

/** The value that bytes in memory spell, the lowest address first, read in an order. */
export function valueOfBytes(bytes: readonly number[], order: ByteOrder): number {
  const written = order === 'big' ? bytes : [...bytes].reverse();
  return written.reduce((value, byte) => value * 0x100 + byte, 0);
}

/** What a stored value reads as when its bytes are taken in the other order. */
export function misread(bits: number, width: number): number {
  return valueOfBytes(storedBytes(bits, width, 'little'), 'big');
}
