import { describe, expect, it } from 'vitest';
import { flagValues, hasCircuit } from './aluLink';
import { solve } from './logic/alu';
import { execute } from './x86/execute';
import type { Mnemonic } from './x86/instructions';
import type { Operand } from './x86/operands';
import type { RegisterName } from './x86/registers';
import { createCpuState, getFlag, readRegister, setFlag, writeRegister } from './x86/state';
import type { FlagName } from './x86/flags';
import { x86AluLink } from './x86AluLink';

const reg = (name: RegisterName): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

const SIZES = [
  { first: 'al', second: 'bl', limit: 0x100 },
  { first: 'ax', second: 'bx', limit: 0x10000 }
] as const;

/** Runs the instruction on a real CPU and checks the circuit gives the same result and flags. */
function agrees(mnemonic: Mnemonic, operands: Operand[]): void {
  const next = random(mnemonic.length * 7919 + operands.length);
  for (let i = 0; i < 60; i++) {
    for (const size of SIZES) {
      const cpu = createCpuState();
      writeRegister(cpu, size.first, next() % size.limit);
      writeRegister(cpu, size.second, next() % size.limit);
      setFlag(cpu, 'CF', next() % 2 === 1);
      const sized = operands.map((operand) =>
        operand.type === 'reg' && operand.name === 'ax'
          ? reg(size.first)
          : operand.type === 'reg' && operand.name === 'bx'
            ? reg(size.second)
            : operand
      );
      const record = execute(cpu, { mnemonic, operands: sized });
      const link = x86AluLink(record);
      if (!hasCircuit(link)) throw new Error(link.unavailable);
      const solution = solve(link.request);
      if (link.resultKept) expect(solution.result).toBe(readRegister(cpu, size.first));
      const flags = flagValues(link, solution);
      for (const [flag, value] of Object.entries(flags)) {
        expect(`${flag}=${value}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
      }
    }
  }
}

describe('x86AluLink', () => {
  it.each(['add', 'adc', 'sub', 'sbb', 'cmp', 'and', 'or', 'xor', 'test'] as const)(
    '%s: the circuit agrees with the CPU',
    (mnemonic) => agrees(mnemonic, [reg('ax'), reg('bx')])
  );

  it.each(['inc', 'dec', 'neg'] as const)('%s: the circuit agrees with the CPU', (mnemonic) =>
    agrees(mnemonic, [reg('ax')])
  );

  it.each(['shl', 'shr', 'sar', 'rol', 'ror', 'rcl', 'rcr'] as const)(
    '%s by 1: the circuit agrees with the CPU',
    (mnemonic) => agrees(mnemonic, [reg('ax'), imm(1)])
  );

  it.each(['shl', 'shr', 'sar', 'rol', 'ror', 'rcl', 'rcr'] as const)(
    '%s by CL: the circuit agrees with the CPU',
    (mnemonic) => {
      const next = random(mnemonic.charCodeAt(2));
      for (let i = 0; i < 60; i++) {
        const cpu = createCpuState();
        writeRegister(cpu, 'ax', next() % 0x10000);
        writeRegister(cpu, 'cl', 1 + (next() % 20));
        setFlag(cpu, 'CF', next() % 2 === 1);
        const record = execute(cpu, { mnemonic, operands: [reg('ax'), reg('cl')] });
        const link = x86AluLink(record);
        if (!hasCircuit(link)) throw new Error(link.unavailable);
        const solution = solve(link.request);
        expect(solution.result).toBe(readRegister(cpu, 'ax'));
        for (const [flag, value] of Object.entries(flagValues(link, solution))) {
          expect(`${flag}=${value}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
        }
      }
    }
  );

  it('connects CF to the inverse of the carry out when subtracting', () => {
    const cpu = createCpuState();
    writeRegister(cpu, 'al', 3);
    const link = x86AluLink(execute(cpu, { mnemonic: 'sub', operands: [reg('al'), imm(5)] }));
    expect(hasCircuit(link) && link.taps.find((tap) => tap.flag === 'CF')).toEqual({
      flag: 'CF',
      tap: 'carryOut',
      inverted: true
    });
  });

  it('feeds SBB the inverse of CF as the carry in', () => {
    const cpu = createCpuState();
    setFlag(cpu, 'CF', true);
    const link = x86AluLink(execute(cpu, { mnemonic: 'sbb', operands: [reg('al'), imm(0)] }));
    expect(hasCircuit(link) && link.request).toMatchObject({ kind: 'subtract', carryIn: 0 });
  });

  it('leaves CF unconnected for INC', () => {
    const cpu = createCpuState();
    const link = x86AluLink(execute(cpu, { mnemonic: 'inc', operands: [reg('ax')] }));
    expect(hasCircuit(link) && link.taps.map((tap) => tap.flag)).not.toContain('CF');
  });

  it('keeps only the flags of a comparison', () => {
    const cpu = createCpuState();
    const link = x86AluLink(execute(cpu, { mnemonic: 'cmp', operands: [reg('ax'), imm(1)] }));
    expect(hasCircuit(link) && link.resultKept).toBe(false);
  });

  it('keeps only the flags of a string compare', () => {
    const cpu = createCpuState();
    writeRegister(cpu, 'al', 1);
    const record = execute(cpu, { mnemonic: 'scasb', operands: [] });
    const link = x86AluLink(record);
    if (!hasCircuit(link)) throw new Error(link.unavailable);
    expect(link.resultKept).toBe(false);
    const flags = flagValues(link, solve(link.request));
    expect(flags.CF).toBe(Number(getFlag(cpu, 'CF')));
    expect(flags.ZF).toBe(Number(getFlag(cpu, 'ZF')));
  });

  it('has no circuit for a multiplication, a move or a shift by 0', () => {
    const cpu = createCpuState();
    const run = (mnemonic: Mnemonic, ...operands: Operand[]) =>
      x86AluLink(execute(cpu, { mnemonic, operands }));
    expect(run('mul', reg('bx'))).toHaveProperty('unavailable');
    expect(run('mov', reg('ax'), imm(1))).toHaveProperty('unavailable');
    expect(run('shl', reg('ax'), reg('cl'))).toHaveProperty('unavailable');
  });
});
