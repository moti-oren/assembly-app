import { beforeEach, describe, expect, it } from 'vitest';
import { execute } from '@/core/x86/execute';
import type { Mnemonic } from '@/core/x86/instructions';
import type { Operand } from '@/core/x86/operands';
import type { RegisterName } from '@/core/x86/registers';
import { createCpuState, physicalAddress, writeRegister, type CpuState } from '@/core/x86/state';
import { describeMemoryAccess, registersWritten, wasWritten } from './describe';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });

let cpu: CpuState;
const run = (mnemonic: Mnemonic, ...operands: Operand[]) => execute(cpu, { mnemonic, operands });

beforeEach(() => {
  cpu = createCpuState();
});

describe('wasWritten', () => {
  it('a written half counts for itself and its word, not for the other half', () => {
    const record = run('mov', reg('al'), imm(0));
    expect(wasWritten(record, 'al')).toBe(true);
    expect(wasWritten(record, 'ax')).toBe(true);
    expect(wasWritten(record, 'ah')).toBe(false);
  });

  it('a written word counts for both halves', () => {
    const record = run('mov', reg('bx'), imm(0));
    expect(wasWritten(record, 'bh')).toBe(true);
    expect(wasWritten(record, 'bl')).toBe(true);
  });

  it('nothing is written before the first instruction', () => {
    expect(wasWritten(null, 'ax')).toBe(false);
  });
});

describe('registersWritten', () => {
  it('comes from what ran, so a REP with CX = 0 lights nothing', () => {
    const record = execute(cpu, { prefix: 'rep', mnemonic: 'movsb', operands: [] });
    expect(registersWritten(record)).toEqual(new Set());
  });

  it('turns byte registers into their words', () => {
    writeRegister(cpu, 'ax', 7);
    writeRegister(cpu, 'bl', 2);
    expect(registersWritten(run('div', reg('bl')))).toEqual(new Set(['ax']));
  });
});

describe('describeMemoryAccess', () => {
  it('gives a repeated store from its first byte, with how many it wrote', () => {
    writeRegister(cpu, 'cx', 8);
    writeRegister(cpu, 'al', 0x2a);
    const record = execute(cpu, { prefix: 'rep', mnemonic: 'stosb', operands: [] });
    const access = describeMemoryAccess(cpu, record);
    expect(access).toMatchObject({ segment: 'es', offset: 0, bytes: 8, write: true });
  });

  it('shows a word at offset FFFF as the 8086 read it, wrapping inside the segment', () => {
    const ds = cpu.registers.ds;
    cpu.memory[physicalAddress(ds, 0xffff)] = 0x34;
    cpu.memory[physicalAddress(ds, 0x0000)] = 0x12;
    writeRegister(cpu, 'bx', 0xffff);
    const record = run('mov', reg('ax'), { type: 'mem', size: 16, base: 'bx', displacement: 0 });
    expect(describeMemoryAccess(cpu, record)?.value).toBe('1234');
  });
});
