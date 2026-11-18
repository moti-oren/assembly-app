import { beforeEach, describe, expect, it } from 'vitest';
import { execute } from '@/core/x86/execute';
import type { Mnemonic } from '@/core/x86/instructions';
import type { Operand } from '@/core/x86/operands';
import type { RegisterName } from '@/core/x86/registers';
import { createCpuState, writeRegister, type CpuState } from '@/core/x86/state';
import { registersWritten, wasWritten } from './describe';

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
