import { describe, expect, it } from 'vitest';
import { PHONE_VIEWS } from './layoutMode';
import { phoneViewOf, STAGE } from './stagePanels';

describe('phoneViewOf', () => {
  it('puts the CPU panels in one view and what is on the bus in the other', () => {
    expect(phoneViewOf('cpu')).toBe('cpu');
    expect(phoneViewOf('registers')).toBe('cpu');
    expect(phoneViewOf('memory')).toBe('memory');
    expect(phoneViewOf('devices')).toBe('memory');
  });

  it('leaves neither stage view empty, whichever CPU view is on show', () => {
    for (const keys of Object.values(STAGE)) {
      const views = new Set(keys.map(phoneViewOf));
      expect(PHONE_VIEWS.filter((view) => view !== 'code').every((view) => views.has(view))).toBe(
        true
      );
    }
  });
});
