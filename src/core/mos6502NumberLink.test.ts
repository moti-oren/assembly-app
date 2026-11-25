import { describe, expect, it } from 'vitest';
import { execute } from './mos6502/execute';
import type { Instruction, Mnemonic } from './mos6502/instructions';
import type { Operand } from './mos6502/operands';
import { createCpuState, getFlag, setFlag, type FlagName } from './mos6502/state';
import { mos6502FreeView, mos6502NumberLink } from './mos6502NumberLink';
import { flagAnswers, hasNumbers } from './numberLink';
import { resultOf, solveNumber } from './representation/request';

const imm = (value: number): Operand => ({ type: 'imm', value });
const zp = (address: number): Operand => ({ type: 'zp', address, index: null });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

/** Runs the instruction on a real CPU and checks the numbers give the same result and flags. */
function agrees(
  mnemonic: Mnemonic,
  operand: (value: number) => Operand | null,
  decimal = false
): void {
  const next = random(mnemonic.charCodeAt(0) * 131 + mnemonic.charCodeAt(2) + Number(decimal));
  for (let i = 0; i < 200; i++) {
    const cpu = createCpuState();
    cpu.registers.a = next() & 0xff;
    cpu.registers.x = next() & 0xff;
    cpu.registers.y = next() & 0xff;
    cpu.memory[0x10] = next() & 0xff;
    setFlag(cpu, 'C', next() % 2 === 1);
    setFlag(cpu, 'D', decimal);
    const given = operand(next() & 0xff);
    const instruction = line(mnemonic, ...(given ? [given] : []));
    const record = execute(cpu, instruction, null, [instruction]);
    const link = mos6502NumberLink(record);
    if (!hasNumbers(link)) throw new Error(link.unavailable);
    const solution = solveNumber(link.request);
    if (link.resultKept) expect(resultOf(solution)).toBe(record.alu!.result.result);
    for (const [flag, value] of Object.entries(flagAnswers(link, solution))) {
      expect(`${flag}=${value}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
    }
  }
}

describe('mos6502NumberLink', () => {
  it.each(['adc', 'sbc', 'cmp', 'cpx', 'cpy'] as const)(
    '%s: the numbers agree with the CPU',
    (mnemonic) => agrees(mnemonic, imm)
  );

  it.each(['inx', 'dex', 'iny', 'dey'] as const)('%s: the numbers agree with the CPU', (mnemonic) =>
    agrees(mnemonic, () => null)
  );

  it.each(['inc', 'dec'] as const)('%s: the numbers agree with the CPU', (mnemonic) =>
    agrees(mnemonic, () => zp(0x10))
  );

  it.each(['adc', 'sbc'] as const)(
    '%s in decimal mode: the digits agree with the CPU on A and C',
    (mnemonic) => agrees(mnemonic, imm, true)
  );

  it('reads C backwards when subtracting', () => {
    const cpu = createCpuState();
    setFlag(cpu, 'C', true);
    const instruction = line('sbc', imm(1));
    const link = mos6502NumberLink(execute(cpu, instruction, null, [instruction]));
    if (!hasNumbers(link)) throw new Error(link.unavailable);
    expect(link.request).toMatchObject({ kind: 'subtract', extra: 0 });
    expect(link.flags.find((reading) => reading.flag === 'C')).toMatchObject({ inverted: true });
    expect(flagAnswers(link, solveNumber(link.request)).C).toBe(0);
  });

  it('shows decimal mode as two digits', () => {
    const cpu = createCpuState();
    cpu.registers.a = 0x19;
    setFlag(cpu, 'D', true);
    const instruction = line('adc', imm(0x03));
    const link = mos6502NumberLink(execute(cpu, instruction, null, [instruction]));
    expect(hasNumbers(link) && link.request).toMatchObject({ kind: 'bcd', operation: 'add' });
    expect(cpu.registers.a).toBe(0x22);
  });

  it.each(['asl', 'lsr'] as const)('%s on A: the numbers agree with the CPU', (mnemonic) =>
    agrees(mnemonic, () => ({ type: 'acc' }))
  );

  it.each(['asl', 'lsr'] as const)('%s on memory: the numbers agree with the CPU', (mnemonic) =>
    agrees(mnemonic, () => zp(0x10))
  );

  it('has nothing to show for bitwise logic, a rotate or a load', () => {
    const cpu = createCpuState();
    const link = (instruction: Instruction) =>
      mos6502NumberLink(execute(cpu, instruction, null, [instruction]));
    expect(link(line('and', imm(1)))).toHaveProperty('unavailable');
    expect(link(line('rol', { type: 'acc' }))).toHaveProperty('unavailable');
    expect(link(line('ror', { type: 'acc' }))).toHaveProperty('unavailable');
    expect(link(line('lda', imm(1)))).toHaveProperty('unavailable');
  });
});

describe('mos6502FreeView', () => {
  it('names a sum or a difference made by hand as the 6502 sets its flags', () => {
    const next = random(6502);
    for (let i = 0; i < 300; i++) {
      const adding = next() % 2 === 0;
      const [a, b, extra] = [next() & 0xff, next() & 0xff, (next() % 2) as 0 | 1];
      const cpu = createCpuState();
      cpu.registers.a = a;
      // ADC adds C; SBC takes one more off when C is 0.
      setFlag(cpu, 'C', adding ? extra === 1 : extra === 0);
      const instruction = line(adding ? 'adc' : 'sbc', imm(b));
      execute(cpu, instruction, null, [instruction]);
      const view = mos6502FreeView({ kind: adding ? 'add' : 'subtract', width: 8, a, b, extra });
      for (const [flag, value] of Object.entries(flagAnswers(view, solveNumber(view.request)))) {
        expect(`${flag}=${value}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
      }
    }
  });
});

describe('the operands of a view', () => {
  it('names what the 6502 compared: the register, then the operand', () => {
    const cpu = createCpuState();
    const instruction = line('cpx', imm(5));
    const link = mos6502NumberLink(execute(cpu, instruction, null, [instruction]));
    expect(hasNumbers(link) && link.operands).toEqual({ a: 'X', b: '#$05' });
    const named = (instruction: Instruction) => {
      const done = mos6502NumberLink(execute(createCpuState(), instruction, null, [instruction]));
      return hasNumbers(done) ? done.operands : null;
    };
    expect(named(line('inc', zp(0x10)))).toEqual({ a: '$10', b: '1' });
    expect(named(line('dey'))).toEqual({ a: 'Y', b: '1' });
  });

  it('shifts by hand as ASL and LSR shift one place, flags and all', () => {
    const next = random(1975);
    for (let i = 0; i < 200; i++) {
      const value = next() & 0xff;
      const left = next() % 2 === 0;
      const cpu = createCpuState();
      cpu.registers.a = value;
      const instruction = line(left ? 'asl' : 'lsr', { type: 'acc' });
      execute(cpu, instruction, null, [instruction]);
      const view = mos6502FreeView({
        kind: 'shift',
        width: 8,
        value,
        direction: left ? 'left' : 'right',
        fill: 'zero',
        count: 1
      });
      for (const [flag, answer] of Object.entries(flagAnswers(view, solveNumber(view.request)))) {
        expect(`${flag}=${answer}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
      }
    }
  });

  it('claims only C for a 16-bit shift, which the 6502 makes of two, and nothing for 0 places', () => {
    const next = random(1616);
    for (let i = 0; i < 200; i++) {
      const value = next() & 0xffff;
      const left = next() % 2 === 0;
      const cpu = createCpuState();
      cpu.memory[0x10] = value & 0xff;
      cpu.memory[0x11] = value >> 8;
      // ASL the low byte and ROL the high one, or LSR the high byte and ROR the low one.
      const steps = left
        ? [line('asl', zp(0x10)), line('rol', zp(0x11))]
        : [line('lsr', zp(0x11)), line('ror', zp(0x10))];
      for (const step of steps) execute(cpu, step, null, [step]);
      const view = mos6502FreeView({
        kind: 'shift',
        width: 16,
        value,
        direction: left ? 'left' : 'right',
        fill: 'zero',
        count: 1
      });
      expect(view.flags.map((flag) => flag.flag)).toEqual(['C']);
      expect(flagAnswers(view, solveNumber(view.request)).C).toBe(Number(getFlag(cpu, 'C')));
    }
    const still = mos6502FreeView({
      kind: 'shift',
      width: 8,
      value: 0x80,
      direction: 'left',
      fill: 'zero',
      count: 0
    });
    expect(still.flags).toEqual([]);
  });

  it('does not claim Z wider than a byte, which the 6502 works out a byte at a time', () => {
    const view = mos6502FreeView({ kind: 'subtract', width: 16, a: 0x101, b: 0x100, extra: 0 });
    expect(view.flags.map((flag) => flag.flag)).not.toContain('Z');
    expect(view.note).toMatch(/a byte at a time/);
  });
});
