import { describe, expect, it } from 'vitest';
import { createIo, readBytes, readMemory, writeBytes, type CpuState } from './state';

function cpu(size: number): CpuState {
  return {
    registers: {},
    flags: 0,
    memory: new Uint8Array(size),
    memoryVersion: 0,
    io: createIo(),
    ioVersion: 0
  };
}

describe('memory bytes', () => {
  it('writes a run of bytes and says what each one was before', () => {
    const state = cpu(16);
    state.memory[5] = 9;
    expect(writeBytes(state, 4, [0x11, 0x122, 0x33])).toEqual([
      { address: 4, before: 0, after: 0x11 },
      { address: 5, before: 9, after: 0x22 },
      { address: 6, before: 0, after: 0x33 }
    ]);
    expect(state.memoryVersion).toBe(1);
    expect(readBytes(state, 4, 3)).toEqual([0x11, 0x22, 0x33]);
  });

  it('wraps around at the end of memory', () => {
    const state = cpu(16);
    writeBytes(state, 15, [0x34, 0x12]);
    expect(state.memory[0]).toBe(0x12);
    expect(readMemory(state, 15, 16)).toBe(0x1234);
  });
});
