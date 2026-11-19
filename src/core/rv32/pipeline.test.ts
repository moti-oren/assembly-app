import { describe, expect, it } from 'vitest';
import { runToEnd, type Program } from '../shared/program';
import { RV32 } from './architecture';
import { EXAMPLE_PROGRAMS } from './examples';
import type { Instruction } from './instructions';
import type { Operand } from './operands';
import { pipelineTiming, type PipelineOptions, type PipelineRow } from './pipeline';

const ZERO = 0;
const T0 = 5;
const T1 = 6;
const T2 = 7;

const reg = (index: number): Operand => ({ type: 'reg', index });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Instruction['mnemonic'], ...operands: Operand[]): Instruction => ({
  mnemonic,
  operands
});
const li = (rd: number, value: number) => line('addi', reg(rd), reg(ZERO), imm(value));

const FORWARDING: PipelineOptions = { forwarding: true };

function timing(program: Program<Instruction>, options = FORWARDING) {
  const state = RV32.createState();
  const { records, error } = runToEnd(RV32, state, program);
  expect(error).toBeNull();
  return pipelineTiming(records, program, options);
}

/** A row as `IF ID EX MEM WB` from its first cycle, with a stalled cycle in lower case. */
function shape(row: PipelineRow): string {
  return row.cycles
    .map((cycle) => (cycle.stalled ? cycle.stage.toLowerCase() : cycle.stage))
    .join(' ');
}

describe('pipelineTiming', () => {
  it('starts one instruction a cycle when none depends on another', () => {
    const result = timing([li(T0, 1), li(T1, 2), li(T2, 3)]);
    expect(result.rows.map((row) => row.cycles[0].cycle)).toEqual([1, 2, 3]);
    expect(result.rows.map(shape)).toEqual(Array(3).fill('IF ID EX MEM WB'));
    // Four cycles to fill the pipeline, then one instruction finishes every cycle.
    expect(result.cycles).toBe(3 + 4);
    expect(result.stallCycles).toBe(0);
  });

  it('forwards an ALU result to the next instruction without a stall', () => {
    const result = timing([li(T0, 1), line('add', reg(T1), reg(T0), reg(T0))]);
    expect(result.rows[1].hazard).toBeNull();
    expect(result.cycles).toBe(6);
  });

  it('records where a forwarded value came from', () => {
    // T0 is one instruction old (still in MEM) and T1 two (in WB) when the add reaches EX.
    const result = timing([li(T1, 1), li(T0, 2), line('add', reg(T2), reg(T0), reg(T1))]);
    expect(result.rows[2].forwards).toEqual([
      { register: T0, producer: 1, from: 'MEM' },
      { register: T1, producer: 0, from: 'WB' }
    ]);
  });

  it('names a register once when both operands are the same one', () => {
    const result = timing([li(T0, 1), line('add', reg(T1), reg(T0), reg(T0))]);
    expect(result.rows[1].forwards).toEqual([{ register: T0, producer: 0, from: 'MEM' }]);
  });

  it('forwards nothing that the register file already holds', () => {
    // Three instructions later, T0 was written back before the add reads it.
    const result = timing([
      li(T0, 1),
      li(T1, 2),
      li(T2, 3),
      line('add', reg(T1), reg(T0), reg(ZERO))
    ]);
    expect(result.rows[3].forwards).toEqual([]);
  });

  it('forwards a loaded value out of WB, after the one cycle it must wait', () => {
    const load = line('lw', reg(T0), { type: 'mem', base: ZERO, offset: 0 });
    const result = timing([load, line('add', reg(T1), reg(T0), reg(ZERO))]);
    expect(result.rows[1].forwards).toEqual([{ register: T0, producer: 0, from: 'WB' }]);
  });

  it('without forwarding, waits in ID until the value is written back', () => {
    const result = timing([li(T0, 1), line('add', reg(T1), reg(T0), reg(T0))], {
      forwarding: false
    });
    expect(shape(result.rows[1])).toBe('IF id id ID EX MEM WB');
    expect(result.rows[1].hazard).toEqual({ register: T0, producer: 0, load: false, cycles: 2 });
    expect(result.rows[1].forwards).toEqual([]);
    expect(result.stallCycles).toBe(2);
    expect(result.cycles).toBe(8);
  });

  it('stalls one cycle for a loaded value even with forwarding', () => {
    const load = line('lw', reg(T0), { type: 'mem', base: ZERO, offset: 0 });
    const result = timing([load, line('add', reg(T1), reg(T0), reg(T0)), li(T2, 3)]);
    expect(result.rows.map(shape)).toEqual([
      'IF ID EX MEM WB',
      'IF id ID EX MEM WB',
      'if IF ID EX MEM WB'
    ]);
    expect(result.rows[1].hazard).toEqual({ register: T0, producer: 0, load: true, cycles: 1 });
    expect(result.stallCycles).toBe(1);
  });

  it('never waits for x0, which every instruction may name', () => {
    const result = timing([li(ZERO, 1), li(T0, 2)], { forwarding: false });
    expect(result.stallCycles).toBe(0);
  });

  it('flushes the two instructions fetched behind a taken branch', () => {
    const program = [line('beq', reg(ZERO), reg(ZERO), label(3)), li(T0, 1), li(T1, 2), li(T2, 3)];
    const result = timing(program);
    expect(result.rows.map((row) => [row.step, row.line, row.flushedBy])).toEqual([
      [0, 0, null],
      [null, 1, 0],
      [null, 2, 0],
      [1, 3, null]
    ]);
    expect(result.rows[0].taken).toBe(true);
    expect(result.rows.map(shape)).toEqual(['IF ID EX MEM WB', 'IF ID', 'IF', 'IF ID EX MEM WB']);
    // The branch is in EX in cycle 3; the target is fetched in cycle 4.
    expect(result.rows[3].cycles[0].cycle).toBe(4);
    expect(result.flushCycles).toBe(2);
    expect(result.cycles).toBe(8);
  });

  it('keeps fetching in order past a branch that is not taken', () => {
    const program = [line('bne', reg(ZERO), reg(ZERO), label(2)), li(T0, 1), li(T1, 2)];
    const result = timing(program);
    expect(result.rows.map((row) => row.step)).toEqual([0, 1, 2]);
    expect(result.flushCycles).toBe(0);
    expect(result.cycles).toBe(7);
  });

  it('flushes behind a jump too, with nothing to fetch past the end of the program', () => {
    const program = [line('jal', reg(ZERO), label(1))];
    const result = timing(program);
    expect(result.rows.slice(1).map((row) => [row.line, row.text])).toEqual([
      [null, ''],
      [null, '']
    ]);
    // Nothing comes after it, so the flush costs no cycles.
    expect(result.flushCycles).toBe(0);
    expect(result.cycles).toBe(5);
  });

  it('holds the instructions behind a stalled one in IF', () => {
    const load = line('lw', reg(T0), { type: 'mem', base: ZERO, offset: 0 });
    const branch = line('beq', reg(T0), reg(T0), label(3));
    const result = timing([load, branch, li(T1, 1), li(T2, 2)]);
    // The branch waits a cycle for t0, and so does the line fetched behind it.
    expect(result.rows.slice(1, 3).map(shape)).toEqual(['IF id ID EX MEM WB', 'if IF ID']);
    expect(result.rows[4].cycles[0].cycle).toBe(6);
  });

  it('accounts for every cycle: one per instruction, four to fill, and each stall and flush', () => {
    for (const { name, program } of EXAMPLE_PROGRAMS) {
      for (const forwarding of [true, false]) {
        const result = timing(program, { forwarding });
        const expected = result.instructions + 4 + result.stallCycles + result.flushCycles;
        expect(result.cycles, `${name}, forwarding ${forwarding}`).toBe(expected);
      }
    }
  });
});
