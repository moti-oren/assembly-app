import type { ValueReadings } from '@/core/representation/readings';

/** One way of reading a row of bits. */
export interface ValueRow {
  name: string;
  value: string;
  /** True when the bits have no reading of this kind. */
  none: boolean;
  /** How the reading is made, in a few words. */
  how: string;
}

const text = (value: number): string => value.toLocaleString('en-US').replace('-', '−');

/** Every reading of a value, in the order they are shown. */
export function valueRows(readings: ValueReadings): ValueRow[] {
  const top = readings.width - 1;
  const characters = readings.characters.map((character) => character ?? '·').join('');
  const hasCharacter = readings.characters.some((character) => character !== null);
  const isDecimal = readings.decimal.every((digits) => digits !== null);
  return [
    {
      name: 'Hex',
      value: `0x${readings.hex}`,
      none: false,
      how: 'four bits to a digit'
    },
    {
      name: 'Unsigned',
      value: text(readings.unsigned),
      none: false,
      how: 'every bit adds its weight'
    },
    {
      name: 'Signed',
      value: text(readings.signed),
      none: false,
      how: `bit ${top} takes its weight away: two’s complement`
    },
    {
      name: 'ASCII',
      value: hasCharacter ? `“${characters}”` : 'no character',
      none: !hasCharacter,
      how: 'a byte from 0x20 to 0x7E is a character'
    },
    {
      name: 'Decimal digits',
      value: isDecimal
        ? readings.decimal.map((digits) => String(digits).padStart(2, '0')).join(' ')
        : 'not decimal',
      none: !isDecimal,
      how: 'each half of a byte is a digit, when it is 0 to 9'
    }
  ];
}
