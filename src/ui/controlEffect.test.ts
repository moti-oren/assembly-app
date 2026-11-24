import { describe, expect, it } from 'vitest';
import { hasControl, solveControl } from '@/core/controlLink';
import type { Faults } from '@/core/logic/fault';
import { execute } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import { parseRegister } from '@/core/rv32/registers';
import { createCpuState, DATA_BASE, writeRegister } from '@/core/rv32/state';
import { rv32ControlLink } from '@/core/rv32ControlLink';
import { memoryBefore } from '@/core/rv32ControlMemory';
import { runDatapath } from '@/core/rv32ControlPath';
import { conflictText, effectRows, effectSummary } from './controlEffect';

const reg = (name: string) => ({ type: 'reg' as const, index: parseRegister(name)! });
const ADD: Instruction = { mnemonic: 'add', operands: [reg('a0'), reg('a1'), reg('a2')] };
const LW: Instruction = {
  mnemonic: 'lw',
  operands: [reg('a0'), { type: 'mem', base: parseRegister('a1')!, offset: 4 }]
};

function outcomes(instruction: Instruction, faults: Faults, a1 = 5) {
  const cpu = createCpuState();
  writeRegister(cpu, parseRegister('a1')!, a1);
  writeRegister(cpu, parseRegister('a2')!, 7);
  cpu.memory.set([0x78, 0x56, 0x34, 0x12], DATA_BASE + 4);
  const record = execute(cpu, instruction, 0, [instruction]);
  const link = rv32ControlLink(record, memoryBefore(cpu, [instruction], record));
  if (!hasControl(link)) throw new Error(link.unavailable);
  const run = (given: Faults) =>
    runDatapath(link.word, solveControl(link.shape, link.word, given), link.context);
  return { broken: run(faults), whole: run({}) };
}

const textOf = (rows: ReturnType<typeof effectRows>, id: string) =>
  rows.find((row) => row.id === id)!;

describe('effectRows', () => {
  it('says what every part did', () => {
    const { whole } = outcomes(ADD, {});
    const rows = effectRows(whole, null);
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'result', 'memory', 'rd', 'pc']);
    expect(textOf(rows, 'a').text).toBe('rs1 (a1), 0x00000005');
    expect(textOf(rows, 'result').text).toBe('0x0000000C');
    expect(textOf(rows, 'memory').text).toBe('not used');
    expect(textOf(rows, 'rd').text).toBe('a0 takes 0x0000000C, the ALU’s result');
    expect(textOf(rows, 'pc').text).toBe('goes to 0x00000004');
    expect(rows.every((row) => row.instead === null)).toBe(true);
  });

  it('says what a load read', () => {
    const { whole } = outcomes(LW, {}, DATA_BASE);
    const rows = effectRows(whole, null);
    expect(textOf(rows, 'memory').text).toBe('reads 4 bytes at 0x00010004: 0x12345678');
    expect(textOf(rows, 'rd').text).toBe('a0 takes 0x12345678, what memory gave');
  });

  it('sets a row a broken line changed beside what it would be', () => {
    const { broken, whole } = outcomes(ADD, { regWrite: 0 });
    const rows = effectRows(broken, whole);
    expect(textOf(rows, 'rd')).toMatchObject({
      text: 'nothing is written',
      instead: 'a0 takes 0x0000000C, the ALU’s result'
    });
    expect(textOf(rows, 'result').instead).toBeNull();
    expect(effectSummary(rows)).toContain('differently: Register.');
  });

  it('says when a broken line changes nothing', () => {
    const { broken, whole } = outcomes(ADD, { regWrite: 1 });
    expect(effectSummary(effectRows(broken, whole))).toContain('change nothing');
  });

  it('says that a trap writes nothing', () => {
    const { broken } = outcomes(ADD, { memRead: 1 }, 0x7fffffff);
    const rows = effectRows(broken, null);
    expect(textOf(rows, 'memory').text).toContain('traps');
    expect(textOf(rows, 'rd').text).toBe('nothing is written: the CPU trapped');
  });
});

describe('conflictText', () => {
  it('names the lines by what the page calls them', () => {
    expect(conflictText({ kind: 'source', lines: ['fromMemory', 'link'] })).toContain(
      'ResultMem and ResultLink are both 1'
    );
    expect(conflictText({ kind: 'noResult', lines: ['memRead'] })).toContain('MemRead uses');
  });
});
