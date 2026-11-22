import { describe, expect, it } from 'vitest';
import { flagValues, hasCircuit } from './aluLink';
import { solve } from './logic/alu';
import { execute } from './mos6502/execute';
import type { Instruction, Mnemonic } from './mos6502/instructions';
import type { Operand } from './mos6502/operands';
import { createCpuState, getFlag, setFlag, type FlagName } from './mos6502/state';
import { mos6502AluLink } from './mos6502AluLink';

const imm = (value: number): Operand => ({ type: 'imm', value });
const zp = (address: number): Operand => ({ type: 'zp', address, index: null });
const A: Operand = { type: 'acc' };
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });

/** A small repeatable generator, so a failure can be run again. */
function random(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
}

/** Runs the instruction on a real CPU and checks the circuit gives the same result and flags. */
function agrees(mnemonic: Mnemonic, operand: (value: number) => Operand | null): void {
  const next = random(mnemonic.charCodeAt(0) * 131 + mnemonic.charCodeAt(2));
  for (let i = 0; i < 120; i++) {
    const cpu = createCpuState();
    cpu.registers.a = next() & 0xff;
    cpu.registers.x = next() & 0xff;
    cpu.registers.y = next() & 0xff;
    cpu.memory[0x10] = next() & 0xff;
    setFlag(cpu, 'C', next() % 2 === 1);
    const given = operand(next() & 0xff);
    const instruction = line(mnemonic, ...(given ? [given] : []));
    const record = execute(cpu, instruction, null, [instruction]);
    const link = mos6502AluLink(record);
    if (!hasCircuit(link)) throw new Error(link.unavailable);
    const solution = solve(link.request);
    expect(solution.result).toBe(record.alu!.result.result);
    for (const [flag, value] of Object.entries(flagValues(link, solution))) {
      expect(`${flag}=${value}`).toBe(`${flag}=${Number(getFlag(cpu, flag as FlagName))}`);
    }
  }
}

describe('mos6502AluLink', () => {
  it.each(['adc', 'sbc', 'cmp', 'cpx', 'cpy', 'and', 'ora', 'eor'] as const)(
    '%s: the circuit agrees with the CPU',
    (mnemonic) => agrees(mnemonic, imm)
  );

  it.each(['asl', 'lsr', 'rol', 'ror'] as const)(
    '%s: the circuit agrees with the CPU',
    (mnemonic) => agrees(mnemonic, () => A)
  );

  it.each(['asl', 'lsr', 'rol', 'ror'] as const)(
    '%s on memory: the circuit agrees with the CPU',
    (mnemonic) => agrees(mnemonic, () => zp(0x10))
  );

  it.each(['inx', 'dex', 'iny', 'dey'] as const)(
    '%s: the circuit agrees with the CPU',
    (mnemonic) => agrees(mnemonic, () => null)
  );

  it.each(['inc', 'dec', 'bit'] as const)('%s: the circuit agrees with the CPU', (mnemonic) =>
    agrees(mnemonic, () => zp(0x10))
  );

  it('connects C straight to the carry out when subtracting', () => {
    const cpu = createCpuState();
    setFlag(cpu, 'C', true);
    const instruction = line('sbc', imm(1));
    const link = mos6502AluLink(execute(cpu, instruction, null, [instruction]));
    expect(hasCircuit(link) && link.taps.find((tap) => tap.flag === 'C')).toEqual({
      flag: 'C',
      tap: 'carryOut',
      inverted: false
    });
    expect(hasCircuit(link) && link.request).toMatchObject({ kind: 'subtract', carryIn: 1 });
  });

  it('has no circuit in decimal mode, or without the ALU', () => {
    const cpu = createCpuState();
    const link = (instruction: Instruction) =>
      mos6502AluLink(execute(cpu, instruction, null, [instruction]));
    expect(link(line('lda', imm(1)))).toHaveProperty('unavailable');
    setFlag(cpu, 'D', true);
    expect(link(line('adc', imm(1)))).toHaveProperty('unavailable');
  });
});
