import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useGridKeys } from './useGridKeys';

const key = (name: string) => ({ key: name, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

describe('useGridKeys', () => {
  it('moves the one stop for Tab with the arrows, and points at the byte focused', () => {
    const point = vi.fn();
    const grid = useGridKeys(ref(null), () => ({ rows: 2, columns: 8 }), {
      point,
      unpoint: vi.fn()
    });
    expect(grid.stop.value).toBe(0);
    const down = key('ArrowDown');
    grid.onKey(down);
    expect(down.preventDefault).toHaveBeenCalled();
    expect(grid.stop.value).toBe(8);
    grid.onCellFocus(1, 3);
    expect(grid.stop.value).toBe(11);
    expect(point).toHaveBeenCalledWith(1, 3);
  });

  it('leaves other keys to the page', () => {
    const grid = useGridKeys(ref(null), () => ({ rows: 2, columns: 8 }), {
      point: vi.fn(),
      unpoint: vi.fn()
    });
    const tab = key('Tab');
    grid.onKey(tab);
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(grid.stop.value).toBe(0);
  });
});
