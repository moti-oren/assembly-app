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

const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const imm = (value: number): Operand => ({ type: 'imm', value });

describe('the cycle in words', () => {
  const program = [
    line('lda', imm(0x42)),
    line('sta', { type: 'abs', address: 0x0200, index: 'x' })
  ];

  it('reads the opcode at PC, and moves PC past the whole instruction', () => {
    expect(describeFetch(1, program)).toBe(
      'PC is $0602, where L1 starts. The CPU reads the opcode there, $9D: STA in the absolute,X mode, 3 bytes in all, so PC moves on to $0605.'
    );
  });

  it('decodes the mode, the registers and the cycles', () => {
    expect(describeDecode(program[1])).toBe(
      'Load & store, absolute,X: The operand = A. It reads A and X. It will write a byte to memory. It takes 5 cycles.'
    );
    expect(describeDecode(line('lda', { type: 'izy', address: 0x10 }))).toContain(
      'It takes 5 cycles, one more if indexing crosses a page.'
    );
  });

  it('says what changed, the cycles taken and where PC is', () => {
    const state = createCpuState();
    const record = execute(state, program[0], 0, program);
    expect(describeExecute(record, state, program)).toBe(
      'It changed A. 2 cycles. PC is at $0602 (L1), the next line.'
    );
  });

  it('says why a branch was taken or not', () => {
    const loop = [line('lda', imm(0)), line('bne', { type: 'label', target: 0 })];
    const state = createCpuState();
    execute(state, loop[0], 0, loop);
    expect(describeExecute(execute(state, loop[1], 1, loop), state, loop)).toBe(
      'Not taken: BNE branches when Z = 0, but Z is 1. 2 cycles. PC is at $0604 (L2), the next line.'
    );
    const back = [line('lda', imm(0)), line('beq', { type: 'label', target: 0 })];
    const again = createCpuState();
    execute(again, back[0], 0, back);
    expect(describeExecute(execute(again, back[1], 1, back), again, back)).toBe(
      'Taken: BEQ branches when Z = 1, and Z is 1. 3 cycles: 2, plus 1 for taking the branch. PC is now $0600 (L0).'
    );
  });

  it('says a flag was already as the instruction leaves it', () => {
    const state = createCpuState();
    const clear = [line('clc'), line('sec')];
    expect(describeExecute(execute(state, clear[0], 0, clear), state, clear)).toBe(
      'C was already 0. 2 cycles. PC is at $0601 (L1), the next line.'
    );
    expect(describeExecute(execute(state, clear[1], 1, clear), state, clear)).toBe(
      'It changed the flags. 2 cycles. PC is at $0602 (L2), the next line.'
    );
  });

  it('says an instruction from the builder ran directly', () => {
    const state = createCpuState();
    const record = execute(state, line('lda', imm(1)), null, []);
    expect(describeExecute(record, state, [])).toBe(
      'Ran directly (not from the program). It changed A. 2 cycles.'
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
    expect(addressSteps(record.addressing!)).toBe('$02F0 + X ($20) = $0310, into page $03');
    expect(cyclesBreakdown(record)).toBe('5 cycles: 4, plus 1 for crossing a page');
  });

  it('follows the pointer of ($nn),Y', () => {
    const state = createCpuState();
    state.memory[0x10] = 0x00;
    state.memory[0x11] = 0x03;
    state.registers.y = 0x05;
    const record = execute(state, line('lda', { type: 'izy', address: 0x10 }), null, []);
    expect(addressSteps(record.addressing!)).toBe(
      'The pointer at $10 holds $0300 + Y ($05) = $0305'
    );
  });

  it('points out the JMP ($xxFF) bug', () => {
    const state = createCpuState();
    state.memory[0x02ff] = 0x00;
    state.memory[0x0200] = 0x06;
    const program = [line('nop')];
    const record = execute(state, line('jmp', { type: 'ind', address: 0x02ff }), null, program);
    expect(addressSteps(record.addressing!)).toBe(
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
    expect(describeAccess(record)).toBe('Wrote $81 to $D010, the LEDs');
  });
});
