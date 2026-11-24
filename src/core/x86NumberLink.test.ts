import { describe, expect, it } from 'vitest';
import { flagAnswers, hasNumbers } from './numberLink';
import { resultOf, solveNumber } from './representation/request';
import { execute } from './x86/execute';
import type { FlagName } from './x86/flags';
import type { Mnemonic } from './x86/instructions';
import type { Operand } from './x86/operands';
import type { RegisterName } from './x86/registers';
import {
  createCpuState,
  getFlag,
  physicalAddress,
  readRegister,
  setFlag,
  writeRegister
} from './x86/state';
import { x86NumberLink } from './x86NumberLink';

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

/** Runs the instruction on a real CPU and checks the numbers give the same result and flags. */
function agrees(mnemonic: Mnemonic, second: boolean): void {
  const next = random(mnemonic.length * 7919 + mnemonic.charCodeAt(1));
  for (let i = 0; i < 80; i++) {
    for (const size of SIZES) {
      const cpu = createCpuState();
      // Values near the ends of the range, where the answers stop fitting, come up often.
      const edge = () => (next() % 3 === 0 ? size.limit / 2 - 2 + (next() % 4) : next());
      writeRegister(cpu, size.first, edge() % size.limit);
      writeRegister(cpu, size.second, edge() % size.limit);
      setFlag(cpu, 'CF', next() % 2 === 1);
      const operands = second ? [reg(size.first), reg(size.second)] : [reg(size.first)];
      const link = x86NumberLink(execute(cpu, { mnemonic, operands }));
      if (!hasNumbers(link)) throw new Error(link.unavailable);
      const solution = solveNumber(link.request);
      if (link.resultKept) expect(resultOf(solution)).toBe(readRegister(cpu, size.first));
      for (const [flag, value] of Object.entries(flagAnswers(link, solution))) {
        expect(`${flag}=${value}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
      }
    }
  }
}

describe('x86NumberLink', () => {
  it.each(['add', 'adc', 'sub', 'sbb', 'cmp'] as const)(
    '%s: the numbers agree with the CPU',
    (mnemonic) => agrees(mnemonic, true)
  );

  it.each(['inc', 'dec', 'neg'] as const)('%s: the numbers agree with the CPU', (mnemonic) =>
    agrees(mnemonic, false)
  );

  it('reads CF on the unsigned scale and OF on the signed one', () => {
    const cpu = createCpuState();
    writeRegister(cpu, 'al', 0x7f);
    const link = x86NumberLink(execute(cpu, { mnemonic: 'add', operands: [reg('al'), imm(1)] }));
    if (!hasNumbers(link)) throw new Error(link.unavailable);
    expect(flagAnswers(link, solveNumber(link.request))).toMatchObject({ CF: 0, OF: 1 });
    expect(link.flags.find((reading) => reading.flag === 'CF')?.scale).toBe('unsigned');
    expect(link.flags.find((reading) => reading.flag === 'OF')?.scale).toBe('signed');
  });

  it('takes the borrow coming into SBB off as well', () => {
    const cpu = createCpuState();
    setFlag(cpu, 'CF', true);
    const link = x86NumberLink(execute(cpu, { mnemonic: 'sbb', operands: [reg('al'), imm(0)] }));
    expect(hasNumbers(link) && link.request).toMatchObject({ kind: 'subtract', extra: 1 });
  });

  it('leaves CF out for INC', () => {
    const cpu = createCpuState();
    const link = x86NumberLink(execute(cpu, { mnemonic: 'inc', operands: [reg('ax')] }));
    expect(hasNumbers(link) && link.flags.map((reading) => reading.flag)).not.toContain('CF');
  });

  it('keeps only the flags of a comparison', () => {
    const cpu = createCpuState();
    const cmp = x86NumberLink(execute(cpu, { mnemonic: 'cmp', operands: [reg('ax'), imm(1)] }));
    expect(hasNumbers(cmp) && cmp.resultKept).toBe(false);
    const scan = x86NumberLink(execute(cpu, { mnemonic: 'scasb', operands: [] }));
    expect(hasNumbers(scan) && scan.resultKept).toBe(false);
  });

  it.each([
    ['cmpsb', 1],
    ['cmpsw', 2]
  ] as const)('%s: the numbers agree with the CPU on what memory held', (mnemonic, bytes) => {
    const next = random(mnemonic.charCodeAt(4) * 97);
    for (let i = 0; i < 80; i++) {
      const cpu = createCpuState();
      writeRegister(cpu, 'si', 0x10);
      writeRegister(cpu, 'di', 0x20);
      const source = physicalAddress(readRegister(cpu, 'ds'), 0x10);
      const target = physicalAddress(readRegister(cpu, 'es'), 0x20);
      // Equal operands come up now and then, so ZF is set as well as cleared.
      const same = next() % 4 === 0;
      for (let byte = 0; byte < bytes; byte++) {
        cpu.memory[source + byte] = next() & 0xff;
        cpu.memory[target + byte] = same ? cpu.memory[source + byte] : next() & 0xff;
      }
      const link = x86NumberLink(execute(cpu, { mnemonic, operands: [] }));
      if (!hasNumbers(link)) throw new Error(link.unavailable);
      expect(link.request).toMatchObject({ kind: 'subtract', width: bytes * 8 });
      for (const [flag, value] of Object.entries(flagAnswers(link, solveNumber(link.request)))) {
        expect(`${flag}=${value}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
      }
    }
  });

  it.each(['shl', 'shr', 'sar'] as const)(
    '%s: the numbers give the CPU’s result and flags',
    (mnemonic) => {
      const next = random(mnemonic.charCodeAt(1) * 613 + mnemonic.charCodeAt(2));
      for (let i = 0; i < 150; i++) {
        for (const size of SIZES) {
          const cpu = createCpuState();
          writeRegister(cpu, size.first, next() % size.limit);
          setFlag(cpu, 'CF', next() % 2 === 1);
          setFlag(cpu, 'OF', next() % 2 === 1);
          // One place comes up often, where CF and OF mean something; so do counts past the width.
          const count = i % 3 === 0 ? 1 : 1 + (next() % 20);
          writeRegister(cpu, 'cl', count);
          const places = count === 1 && i % 2 === 0 ? imm(1) : reg('cl');
          const record = execute(cpu, { mnemonic, operands: [reg(size.first), places] });
          const link = x86NumberLink(record);
          if (!hasNumbers(link)) throw new Error(link.unavailable);
          const solution = solveNumber(link.request);
          expect(resultOf(solution), `${mnemonic} by ${count}`).toBe(readRegister(cpu, size.first));
          for (const [flag, value] of Object.entries(flagAnswers(link, solution))) {
            expect(`${flag}=${value}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
          }
        }
      }
    }
  );

  it('reads CF and OF as questions about the numbers after one place only', () => {
    const flagsOf = (mnemonic: Mnemonic, count: number) => {
      const cpu = createCpuState();
      writeRegister(cpu, 'cl', count);
      const link = x86NumberLink(execute(cpu, { mnemonic, operands: [reg('ax'), reg('cl')] }));
      if (!hasNumbers(link)) throw new Error(link.unavailable);
      return link.flags.map((reading) => `${reading.flag} ${reading.verdict}`);
    };
    expect(flagsOf('shl', 1)).toEqual(['CF outside', 'OF outside', 'ZF zero', 'SF negative']);
    expect(flagsOf('sar', 1)).toEqual(['CF remainder', 'ZF zero', 'SF negative']);
    expect(flagsOf('shl', 3)).toEqual(['ZF zero', 'SF negative']);
  });

  it('has nothing to show for a shift by no places, which changes no flag', () => {
    const cpu = createCpuState();
    writeRegister(cpu, 'cl', 0);
    const link = x86NumberLink(execute(cpu, { mnemonic: 'shl', operands: [reg('ax'), reg('cl')] }));
    expect(link).toHaveProperty('unavailable');
  });

  it('names the carry of a halving on the scale of its fill', () => {
    const scaleOf = (mnemonic: Mnemonic) => {
      const link = x86NumberLink(
        execute(createCpuState(), { mnemonic, operands: [reg('ax'), imm(1)] })
      );
      return hasNumbers(link) && link.flags[0].scale;
    };
    expect(scaleOf('shr')).toBe('unsigned');
    expect(scaleOf('sar')).toBe('signed');
  });

  it('has nothing to show for bitwise logic, a rotate, a multiplication or a move', () => {
    const cpu = createCpuState();
    const run = (mnemonic: Mnemonic, ...operands: Operand[]) =>
      x86NumberLink(execute(cpu, { mnemonic, operands }));
    expect(run('and', reg('ax'), imm(1))).toHaveProperty('unavailable');
    expect(run('rol', reg('ax'), imm(1))).toHaveProperty('unavailable');
    expect(run('rcr', reg('ax'), imm(1))).toHaveProperty('unavailable');
    expect(run('mul', reg('bx'))).toHaveProperty('unavailable');
    expect(run('mov', reg('ax'), imm(1))).toHaveProperty('unavailable');
  });
});
