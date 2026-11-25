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
import { x86FreeView, x86NumberLink } from './x86NumberLink';

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

describe('x86FreeView', () => {
  it('names a sum or a difference made by hand as the 8086 sets its flags', () => {
    const next = random(8086);
    for (let i = 0; i < 300; i++) {
      const adding = next() % 2 === 0;
      const [a, b, extra] = [next() & 0xff, next() & 0xff, (next() % 2) as 0 | 1];
      const cpu = createCpuState();
      writeRegister(cpu, 'al', a);
      writeRegister(cpu, 'bl', b);
      // ADC adds CF; SBB takes CF more off.
      setFlag(cpu, 'CF', extra === 1);
      execute(cpu, { mnemonic: adding ? 'adc' : 'sbb', operands: [reg('al'), reg('bl')] });
      const view = x86FreeView({ kind: adding ? 'add' : 'subtract', width: 8, a, b, extra });
      for (const [flag, value] of Object.entries(flagAnswers(view, solveNumber(view.request)))) {
        expect(`${flag}=${value}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
      }
    }
  });

  it('names the operands of an instruction as it wrote them', () => {
    const named = (mnemonic: Mnemonic, ...operands: Operand[]) => {
      const link = x86NumberLink(execute(createCpuState(), { mnemonic, operands }));
      return hasNumbers(link) ? link.operands : null;
    };
    expect(named('cmp', reg('ax'), imm(5))).toEqual({ a: 'ax', b: '5' });
    // NEG takes its operand from 0; INC and DEC add or take a 1 they do not name.
    expect(named('neg', reg('ax'))).toEqual({ a: '0', b: 'ax' });
    expect(named('inc', reg('bl'))).toEqual({ a: 'bl', b: '1' });
    // The string compares read what SI and DI point at, and SCAS the accumulator.
    expect(named('scasb')).toEqual({ a: 'al', b: 'byte [es:di]' });
    expect(named('cmpsw')).toEqual({ a: 'word [ds:si]', b: 'word [es:di]' });
  });

  it('shifts by hand as the 8086 shifts one place, flags and all', () => {
    const next = random(1978);
    for (let i = 0; i < 200; i++) {
      const value = next() & 0xff;
      const mnemonic = (['shl', 'shr', 'sar'] as const)[next() % 3];
      const cpu = createCpuState();
      writeRegister(cpu, 'al', value);
      execute(cpu, { mnemonic, operands: [reg('al'), imm(1)] });
      const view = x86FreeView({
        kind: 'shift',
        width: 8,
        value,
        direction: mnemonic === 'shl' ? 'left' : 'right',
        fill: mnemonic === 'sar' ? 'sign' : 'zero',
        count: 1
      });
      for (const [flag, answer] of Object.entries(flagAnswers(view, solveNumber(view.request)))) {
        expect(`${mnemonic} ${flag}=${answer}`).toBe(
          `${mnemonic} ${flag}=${Number(getFlag(cpu, flag as FlagName))}`
        );
      }
    }
  });

  it('claims only CF for a 32-bit shift, which the 8086 makes of two, and nothing for 0 places', () => {
    const next = random(3232);
    for (let i = 0; i < 200; i++) {
      const value = (next() & 0xffff) | ((next() & 0xffff) << 16);
      const left = next() % 2 === 0;
      const cpu = createCpuState();
      writeRegister(cpu, 'ax', value & 0xffff);
      writeRegister(cpu, 'dx', value >>> 16);
      // A 32-bit shift by one: SHL AX and RCL DX, or SHR DX and RCR AX.
      const steps: [Mnemonic, RegisterName][] = left
        ? [
            ['shl', 'ax'],
            ['rcl', 'dx']
          ]
        : [
            ['shr', 'dx'],
            ['rcr', 'ax']
          ];
      for (const [mnemonic, name] of steps)
        execute(cpu, { mnemonic, operands: [reg(name), imm(1)] });
      const view = x86FreeView({
        kind: 'shift',
        width: 32,
        value: value >>> 0,
        direction: left ? 'left' : 'right',
        fill: 'zero',
        count: 1
      });
      expect(view.flags.map((flag) => flag.flag)).toEqual(['CF']);
      const answers = flagAnswers(view, solveNumber(view.request));
      expect(answers.CF).toBe(Number(getFlag(cpu, 'CF')));
    }
    const still = x86FreeView({
      kind: 'shift',
      width: 8,
      value: 0x80,
      direction: 'left',
      fill: 'zero',
      count: 0
    });
    expect(still.flags).toEqual([]);
  });

  it('does not claim ZF for 32 bits, which the 8086 works out a word at a time', () => {
    const view = x86FreeView({ kind: 'subtract', width: 32, a: 0x10001, b: 0x10000, extra: 0 });
    expect(view.flags.map((flag) => flag.flag)).not.toContain('ZF');
    expect(view.note).toMatch(/a word at a time/);
  });
});
