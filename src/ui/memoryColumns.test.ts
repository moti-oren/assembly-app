import { describe, expect, it } from 'vitest';
import { columnGap, memoryColumns, rowStart } from './memoryColumns';

describe('memoryColumns', () => {
  it('holds sixteen bytes a row where they fit', () => {
    expect(memoryColumns(600)).toBe(16);
    expect(memoryColumns(1382)).toBe(16);
  });

  it('holds eight on a narrow screen', () => {
    expect(memoryColumns(313)).toBe(8);
    expect(memoryColumns(599)).toBe(8);
  });
});

describe('rowStart', () => {
  it('rounds an address down to its row', () => {
    expect(rowStart(0x1f7, 16)).toBe(0x1f0);
    expect(rowStart(0x1f7, 8)).toBe(0x1f0);
    expect(rowStart(0x1fd, 8)).toBe(0x1f8);
  });
});

describe('columnGap', () => {
  it('sets every fourth column apart, and the eighth further', () => {
    expect(columnGap(0)).toBeNull();
    expect(columnGap(3)).toBeNull();
    expect(columnGap(4)).toBe('narrow');
    expect(columnGap(8)).toBe('wide');
    expect(columnGap(12)).toBe('narrow');
  });
});
