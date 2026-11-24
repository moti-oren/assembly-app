import { describe, expect, it } from 'vitest';
import { execute } from './rv32/execute';
import type { Instruction } from './rv32/instructions';
import { parseRegister } from './rv32/registers';
import { setInputPort } from './shared/state';
import { createCpuState, DATA_BASE, DEVICE_BASE, writeRegister } from './rv32/state';
import { memoryBefore } from './rv32ControlMemory';

const A0 = parseRegister('a0')!;
const A1 = parseRegister('a1')!;
const SW: Instruction = {
  mnemonic: 'sw',
  operands: [
    { type: 'reg', index: A0 },
    { type: 'mem', base: A1, offset: 0 }
  ]
};

function stored() {
  const cpu = createCpuState();
  writeRegister(cpu, A0, 0x11223344);
  writeRegister(cpu, A1, DATA_BASE);
  cpu.memory.set([0xaa, 0xbb, 0xcc, 0xdd, 0xee], DATA_BASE);
  const record = execute(cpu, SW, 0, [SW]);
  return { cpu, memory: memoryBefore(cpu, [SW], record) };
}

describe('memoryBefore', () => {
  it('reads what the instruction found, not what it wrote', () => {
    const { cpu, memory } = stored();
    expect(cpu.memory[DATA_BASE]).toBe(0x44);
    expect(memory.read(DATA_BASE, 4)).toBe(0xddccbbaa);
    expect(memory.read(DATA_BASE + 2, 2)).toBe(0xddcc);
    expect(memory.read(DATA_BASE + 4, 1)).toBe(0xee);
  });

  it('keeps what a load read from a device, whatever the device presents later', () => {
    const cpu = createCpuState();
    const lbu: Instruction = {
      mnemonic: 'lbu',
      operands: [
        { type: 'reg', index: A0 },
        { type: 'mem', base: A1, offset: 0 }
      ]
    };
    writeRegister(cpu, A1, DEVICE_BASE);
    setInputPort(cpu, 0, 0x41);
    const memory = memoryBefore(cpu, [lbu], execute(cpu, lbu, 0, [lbu]));
    setInputPort(cpu, 0, 0x42);
    expect(memory.read(DEVICE_BASE, 1)).toBe(0x41);
  });

  it('reads the code as its machine code', () => {
    expect(stored().memory.read(0, 4)).toBe(0x00a5a023);
  });

  it('gives the fault of a read the CPU would trap on', () => {
    const { memory } = stored();
    expect(memory.read(DATA_BASE + 1, 4)).toMatchObject({ fault: expect.stringContaining('Mis') });
    expect(memory.read(0x200000, 4)).toMatchObject({ fault: expect.stringContaining('Access') });
  });

  it('says whether a store would trap, and writes nothing', () => {
    const { cpu, memory } = stored();
    expect(memory.storeFault(DATA_BASE + 8, 4)).toBeNull();
    expect(memory.storeFault(DEVICE_BASE, 1)).toBeNull();
    expect(memory.storeFault(0, 4)).toContain('Store into code');
    expect(cpu.memory[DATA_BASE + 8]).toBe(0);
  });
});
