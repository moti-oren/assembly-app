import { describe, expect, it } from 'vitest';
import { PORTS } from '@/core/shared/devices';
import { writePort } from '@/core/shared/state';
import { codeByte } from '@/core/mos6502/encode';
import type { Instruction } from '@/core/mos6502/instructions';
import { CODE_BASE, createCpuState, DEVICE_BASE } from '@/core/mos6502/state';
import { byteAt, mos6502MemoryPlaces } from './mos6502View';

const program: Instruction[] = [{ mnemonic: 'lda', operands: [{ type: 'imm', value: 0x42 }] }];

describe('byteAt', () => {
  it('reads the code as its machine code, RAM as itself and devices as they show', () => {
    const state = createCpuState();
    state.memory[0x0200] = 7;
    writePort(state, PORTS.leds, 0x81);
    expect(byteAt(state, program, CODE_BASE)).toEqual({
      address: CODE_BASE,
      value: codeByte(program, CODE_BASE),
      region: 'code'
    });
    expect(byteAt(state, program, 0x0200).value).toBe(7);
    expect(byteAt(state, program, DEVICE_BASE + PORTS.leds)).toMatchObject({
      value: 0x81,
      region: 'device'
    });
  });
});

describe('mos6502MemoryPlaces', () => {
  it('puts the top of the stack just above SP, in page 1', () => {
    const state = createCpuState();
    state.registers.sp = 0xfb;
    const stack = mos6502MemoryPlaces(state).find((place) => place.stack)!;
    expect(stack.start()).toBe(0x01fc);
  });
});
