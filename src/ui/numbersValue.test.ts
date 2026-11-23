import { describe, expect, it } from 'vitest';
import { readValue } from '@/core/representation/readings';
import { valueRows } from './numbersValue';

const values = (bits: number, width: 8 | 16 | 32) =>
  Object.fromEntries(valueRows(readValue(bits, width)).map((row) => [row.name, row.value]));

describe('valueRows', () => {
  it('reads a byte every way', () => {
    expect(values(0x41, 8)).toEqual({
      Hex: '0x41',
      Unsigned: '65',
      Signed: '65',
      ASCII: '“A”',
      'Decimal digits': '41'
    });
  });

  it('says where a reading does not apply', () => {
    const rows = valueRows(readValue(0xfa, 8));
    expect(rows.find((row) => row.name === 'Signed')?.value).toBe('−6');
    expect(rows.find((row) => row.name === 'ASCII')).toMatchObject({
      value: 'no character',
      none: true
    });
    expect(rows.find((row) => row.name === 'Decimal digits')).toMatchObject({ none: true });
  });

  it('marks the bytes of a wide value that are no character', () => {
    expect(values(0x4100, 16).ASCII).toBe('“A·”');
  });

  it('names the bit that makes the signed reading negative', () => {
    const signed = valueRows(readValue(0, 32)).find((row) => row.name === 'Signed');
    expect(signed?.how).toContain('bit 31');
  });
});
