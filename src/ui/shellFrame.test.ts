import { describe, expect, it } from 'vitest';
import { shellFrame } from './shellFrame';
import { TOPIC_CHOICES } from './topics';

describe('shellFrame', () => {
  it('names the CPU page by the architecture on show', () => {
    expect(shellFrame('cpu', 'rv32').badge).toBe('RV');
    expect(shellFrame('cpu', 'mos6502').badge).toBe('65');
    expect(shellFrame('cpu', 'x86').drawer.word).toBe('Code');
  });

  it('gives a topic its own chip whatever the CPU', () => {
    expect(shellFrame('logic', 'x86').badge).toBe('LG');
    expect(shellFrame('logic', 'rv32').badge).toBe('LG');
    expect(shellFrame('storage', 'x86').drawer.word).toBe('Controls');
  });

  it('labels every view of every page, and its sidebar view is one of them', () => {
    for (const { id } of TOPIC_CHOICES) {
      const frame = shellFrame(id, 'x86');
      expect(frame.views).toContain(frame.sidebarView);
      for (const view of frame.views) expect(frame.viewLabels[view]).toBeTruthy();
    }
  });

  it("names a topic's stage tab after what it draws", () => {
    expect(shellFrame('logic', 'x86').viewLabels.stage).toBe('Circuit');
    expect(shellFrame('control', 'x86').viewLabels.stage).toBe('Control unit');
  });
});
