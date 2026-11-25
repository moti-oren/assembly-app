import { describe, expect, it } from 'vitest';
import { PORTS } from '@/core/shared/devices';
import { setInputPort, writePort } from '@/core/shared/state';
import { wordAt } from '@/core/rv32/encode';
import type { Instruction } from '@/core/rv32/instructions';
import { createCpuState, DATA_BASE, DEVICE_BASE, RAM_SIZE } from '@/core/rv32/state';
import { memoryRows } from './flatMemory';
import { byteAt, REGISTER_GROUPS, signedText } from './rv32View';

const program: Instruction[] = [
  {
    mnemonic: 'addi',
    operands: [
      { type: 'reg', index: 10 },
      { type: 'reg', index: 0 },
      { type: 'imm', value: 5 }
    ]
  }
];

describe('REGISTER_GROUPS', () => {
  it('lists all 32 registers once, the special ones first and in their own order', () => {
    const rows = REGISTER_GROUPS.flatMap((group) => group.rows);
    expect(new Set(rows.map((row) => row.index)).size).toBe(32);
    expect(REGISTER_GROUPS[0].rows.map((row) => row.abi)).toEqual(['zero', 'ra', 'sp', 'gp', 'tp']);
    expect(REGISTER_GROUPS[3].rows.map((row) => row.abi).slice(0, 3)).toEqual(['s0', 's1', 's2']);
  });
});

describe('byteAt', () => {
  it('reads the code as its machine code, low byte first', () => {
    const state = createCpuState();
    const word = wordAt(program, 0);
    expect(byteAt(state, program, 0)).toEqual({ address: 0, value: word & 0xff, region: 'code' });
    expect(byteAt(state, program, 3).value).toBe(word >>> 24);
  });

  it('shows what an output device was given, and what an input device presents', () => {
    const state = createCpuState();
    writePort(state, PORTS.leds, 0x81);
    setInputPort(state, PORTS.switches, 0x42);
    expect(byteAt(state, program, DEVICE_BASE + PORTS.leds).value).toBe(0x81);
    expect(byteAt(state, program, DEVICE_BASE + PORTS.switches).value).toBe(0x42);
  });

  it('has no value where nothing is wired', () => {
    expect(byteAt(createCpuState(), program, RAM_SIZE).value).toBeNull();
  });
});

describe('memoryRows', () => {
  it('starts at the row the address falls in', () => {
    const state = createCpuState();
    const rows = memoryRows((address) => byteAt(state, program, address), DATA_BASE + 0x13, 2);
    expect(rows.map((row) => row[0].address)).toEqual([DATA_BASE + 0x10, DATA_BASE + 0x20]);
    expect(rows[0].length).toBe(16);
  });
});

describe('signedText', () => {
  it('reads a register as signed, with a true minus sign', () => {
    expect(signedText(0xffffffff)).toBe('−1');
    expect(signedText(5)).toBe('5');
  });
});
