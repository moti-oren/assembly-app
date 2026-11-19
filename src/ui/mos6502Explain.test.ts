import { describe, expect, it } from 'vitest';
import { PORTS } from '@/core/shared/devices';
import { execute } from '@/core/mos6502/execute';
import type { Instruction, Mnemonic } from '@/core/mos6502/instructions';
import type { Operand } from '@/core/mos6502/operands';
import { createCpuState, DEVICE_BASE } from '@/core/mos6502/state';
import {
  addressSteps,
  cyclesBreakdown,
  describeAccess,
  describeDecode,
  describeExecute,
  describeFetch
} from './mos6502Explain';
import { messagesFor } from './locale';

const m = messagesFor('en');

const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const imm = (value: number): Operand => ({ type: 'imm', value });

describe('the cycle in words', () => {
  const program = [
    line('lda', imm(0x42)),
    line('sta', { type: 'abs', address: 0x0200, index: 'x' })
  ];

  it('reads the opcode at PC, and moves PC past the whole instruction', () => {
    expect(describeFetch(m, 1, program)).toBe(
      'PC is $0602, where L1 starts. The CPU reads the opcode there, $9D: STA in the absolute,X mode, 3 bytes in all, so PC moves on to $0605.'
    );
  });

  it('decodes the mode, the registers and the cycles', () => {
    expect(describeDecode(m, program[1])).toBe(
      'Load & store, absolute,X: The operand = A. It reads A and X. It will write a byte to memory. It takes 5 cycles.'
    );
    expect(describeDecode(m, line('lda', { type: 'izy', address: 0x10 }))).toContain(
      'It takes 5 cycles, one more if indexing crosses a page.'
    );
  });

  it('says what changed, the cycles taken and where PC is', () => {
    const state = createCpuState();
    const record = execute(state, program[0], 0, program);
    expect(describeExecute(m, record, state, program)).toBe(
      'It changed A. 2 cycles. PC is at $0602 (L1), the next line.'
    );
  });
});

describe('addressSteps', () => {
  it('shows indexing and a page crossing', () => {
    const state = createCpuState();
    state.registers.x = 0x20;
    const record = execute(
      state,
      line('lda', { type: 'abs', address: 0x02f0, index: 'x' }),
      null,
      []
    );
    expect(addressSteps(m, record.addressing!)).toBe('$02F0 + X ($20) = $0310, into page $03');
    expect(cyclesBreakdown(m, record)).toBe('5 cycles: 4, plus 1 for crossing a page');
  });

  it('follows the pointer of ($nn),Y', () => {
    const state = createCpuState();
    state.memory[0x10] = 0x00;
    state.memory[0x11] = 0x03;
    state.registers.y = 0x05;
    const record = execute(state, line('lda', { type: 'izy', address: 0x10 }), null, []);
    expect(addressSteps(m, record.addressing!)).toBe(
      'The pointer at $10 holds $0300 + Y ($05) = $0305'
    );
  });

  it('sets the sum apart whole in Hebrew, so it reads left to right', () => {
    const state = createCpuState();
    state.memory[0x11] = 0x03;
    state.registers.y = 0x05;
    const record = execute(state, line('lda', { type: 'izy', address: 0x10 }), null, []);
    expect(addressSteps(messagesFor('he'), record.addressing!)).toContain(
      '\u2066$0300 + Y ($05) = $0305\u2069'
    );
  });

  it('points out the JMP ($xxFF) bug', () => {
    const state = createCpuState();
    state.memory[0x02ff] = 0x00;
    state.memory[0x0200] = 0x06;
    const program = [line('nop')];
    const record = execute(state, line('jmp', { type: 'ind', address: 0x02ff }), null, program);
    expect(addressSteps(m, record.addressing!)).toBe(
      'The address stored at $02FF is $0600, its high byte read from $0200: the NMOS bug'
    );
  });
});

describe('describeAccess', () => {
  it('names the device a byte went to', () => {
    const state = createCpuState();
    state.registers.a = 0x81;
    const record = execute(
      state,
      line('sta', { type: 'abs', address: DEVICE_BASE + PORTS.leds, index: null }),
      null,
      []
    );
    expect(describeAccess(m, record)).toBe('Wrote $81 to $D010, the LEDs');
  });
});
