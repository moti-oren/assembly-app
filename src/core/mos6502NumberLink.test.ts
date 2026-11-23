import { describe, expect, it } from 'vitest';
import { execute } from './mos6502/execute';
import type { Instruction, Mnemonic } from './mos6502/instructions';
import type { Operand } from './mos6502/operands';
import { createCpuState, getFlag, setFlag, type FlagName } from './mos6502/state';
import { mos6502NumberLink } from './mos6502NumberLink';
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

  it('has nothing to show for bitwise logic, a shift or a load', () => {
    const cpu = createCpuState();
    const link = (instruction: Instruction) =>
      mos6502NumberLink(execute(cpu, instruction, null, [instruction]));
    expect(link(line('and', imm(1)))).toHaveProperty('unavailable');
    expect(link(line('asl', { type: 'acc' }))).toHaveProperty('unavailable');
    expect(link(line('lda', imm(1)))).toHaveProperty('unavailable');
  });
});
