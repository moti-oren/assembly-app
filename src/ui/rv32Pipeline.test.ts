import { describe, expect, it } from 'vitest';
import { runToEnd, type Program } from '@/core/shared/program';
import { RV32 } from '@/core/rv32/architecture';
import type { Instruction } from '@/core/rv32/instructions';
import type { Operand } from '@/core/rv32/operands';
import type { PredictorKind } from '@/core/rv32/branchPredictor';
import { pipelineTiming } from '@/core/rv32/pipeline';
import { pipelineGrid, pipelineNotes, pipelineSummary } from './rv32Pipeline';

const T0 = 5;
const T1 = 6;
const reg = (index: number): Operand => ({ type: 'reg', index });
const line = (mnemonic: Instruction['mnemonic'], ...operands: Operand[]): Instruction => ({
  mnemonic,
  operands
});
const li = (rd: number, value: number) => line('addi', reg(rd), reg(0), { type: 'imm', value });
const load = line('lw', reg(T0), { type: 'mem', base: 0, offset: 0 });
const use = line('add', reg(T1), reg(T0), reg(T0));
const branchTo = (target: number) => line('beq', reg(0), reg(0), { type: 'label', target });

function timing(
  program: Program<Instruction>,
  forwarding = true,
  predictor: PredictorKind = 'not-taken'
) {
  const { records } = runToEnd(RV32, RV32.createState(), program);
  return pipelineTiming(records, program, { forwarding, predictor });
}

describe('pipelineGrid', () => {
  it('lays the rows out over the cycles they span', () => {
    const grid = pipelineGrid(timing([load, use]), 10);
    expect(grid.cycles).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(grid.rows.map((row) => row.cells.map((cell) => cell?.stage ?? '·').join(' '))).toEqual([
      'IF ID EX MEM WB · ·',
      '· IF ID ID EX MEM WB'
    ]);
    expect(grid.rows[1].cells[2]).toEqual({ stage: 'ID', kind: 'stall' });
    expect(grid.rows.map((row) => [row.label, row.text, row.newest])).toEqual([
      ['L0', 'lw t0, 0(zero)', false],
      ['L1', 'add t1, t0, t0', true]
    ]);
  });

  it('shows only the last rows, numbered among all of them', () => {
    const grid = pipelineGrid(timing([li(T0, 1), li(T0, 2), li(T0, 3)]), 2);
    expect(grid.from).toBe(1);
    expect(grid.rows.map((row) => row.key)).toEqual([1, 2]);
    expect(grid.cycles).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('marks the flushed rows, and a fetch past the end', () => {
    const grid = pipelineGrid(timing([branchTo(2), li(T0, 1)]), 10);
    expect(grid.rows.map((row) => [row.text, row.flushed])).toEqual([
      ['beq zero, zero, L2', false],
      ['addi t0, zero, 1', true],
      ['past the end', true]
    ]);
    expect(grid.rows[2].cells[2]).toEqual({ stage: 'IF', kind: 'flushed' });
  });

  it('marks where a branch decides with whether it was guessed right', () => {
    const ex = (predictor: PredictorKind) =>
      pipelineGrid(timing([branchTo(2), li(T0, 1)], true, predictor), 10).rows[0].cells[2];
    expect(ex('not-taken')).toEqual({ stage: 'EX', kind: 'run', guess: 'wrong' });
    expect(ex('taken')).toEqual({ stage: 'EX', kind: 'run', guess: 'right' });
  });

  it('joins an EX to the stage a result was forwarded from, in the same cycle', () => {
    const grid = pipelineGrid(timing([li(T0, 1), use]), 10);
    // The add is in EX in cycle 4, while the addi above it is in MEM.
    expect(grid.rows[1].cells[3]).toEqual({
      stage: 'EX',
      kind: 'run',
      forwarded: [{ rows: 1, text: 't0 forwarded from L0 (addi t0, zero, 1), in MEM' }]
    });
    expect(grid.rows[0].cells[3]).toEqual({ stage: 'MEM', kind: 'run', source: true });
    expect(grid.forwards).toBe(true);
  });

  it('draws no line to an instruction that is not among the rows shown', () => {
    const grid = pipelineGrid(timing([li(T0, 1), use]), 1);
    expect(grid.rows[0].cells.find((cell) => cell?.stage === 'EX')?.forwarded?.[0].rows).toBe(0);
  });

  it('has no forwards when forwarding is off', () => {
    const grid = pipelineGrid(timing([li(T0, 1), use], false), 10);
    expect(grid.forwards).toBe(false);
    expect(grid.rows.flatMap((row) => row.cells).some((cell) => cell?.forwarded)).toBe(false);
  });

  it('is empty before anything has run', () => {
    expect(pipelineGrid(timing([]), 10)).toEqual({
      from: 0,
      cycles: [],
      rows: [],
      forwards: false
    });
  });
});

const FORWARDING = { forwarding: true };

describe('pipelineNotes', () => {
  it('says why an instruction waited, and what a taken branch flushed', () => {
    expect(pipelineNotes(timing([load, use]), 0, { forwarding: true })).toEqual([
      'L1 (add t1, t0, t0) waits 1 cycle in ID for t0: the load on L0 (lw t0, 0(zero)) has it only after MEM.'
    ]);
    expect(pipelineNotes(timing([li(T0, 1), use], false), 0, { forwarding: false })).toEqual([
      'L1 (add t1, t0, t0) waits 2 cycles in ID for t0: forwarding is off, so L0 (addi t0, zero, 1) must write it back first.'
    ]);
    expect(pipelineNotes(timing([branchTo(2), li(T0, 1)]), 0, { forwarding: true })).toEqual([
      'L0 (beq zero, zero, L2) was guessed not taken and is taken: the two instructions fetched behind it are flushed.'
    ]);
  });

  it('says what a branch guessed taken saved, and keeps the old words for a jump', () => {
    expect(pipelineNotes(timing([branchTo(2), li(T0, 1)], true, 'taken'), 0, FORWARDING)).toEqual([
      'L0 (beq zero, zero, L2) was guessed taken, and is: its target was fetched behind it, and nothing is flushed.'
    ]);
    const jump = line('jal', reg(0), { type: 'label', target: 1 });
    expect(pipelineNotes(timing([jump]), 0, FORWARDING)).toEqual([
      'L0 (jal zero, L1) changes PC in EX: the two instructions fetched behind it are flushed.'
    ]);
  });

  it('has nothing to say about a branch guessed not taken that is not', () => {
    const never = line('bne', reg(0), reg(0), { type: 'label', target: 1 });
    expect(pipelineNotes(timing([never]), 0, FORWARDING)).toEqual([]);
  });

  it('gives a load the write-back reason when forwarding is off, since it waits until WB', () => {
    expect(pipelineNotes(timing([load, use], false), 0, { forwarding: false })).toEqual([
      'L1 (add t1, t0, t0) waits 2 cycles in ID for t0: forwarding is off, so L0 (lw t0, 0(zero)) must write it back first.'
    ]);
  });

  it('leaves out the rows before the ones shown', () => {
    expect(pipelineNotes(timing([load, use]), 2, { forwarding: true })).toEqual([]);
  });
});

describe('pipelineSummary', () => {
  it('breaks the cycles down', () => {
    expect(pipelineSummary(timing([li(T0, 1), li(T1, 2)]))).toBe(
      '6 cycles = 2 instructions + 4 to fill the pipeline · 3.00 cycles per instruction'
    );
    expect(pipelineSummary(timing([load, use, branchTo(4), li(T0, 1), li(T1, 2)]))).toBe(
      '11 cycles = 4 instructions + 4 to fill the pipeline + 1 stalled + 2 lost to flushes · 2.75 cycles per instruction · 0 of 1 branch guessed right'
    );
  });

  it('says what a jump at the very end will cost the next instruction', () => {
    expect(pipelineSummary(timing([li(T0, 1), branchTo(0)]))).toContain(
      '+2 more for the next instruction, if there were one'
    );
    expect(pipelineSummary(timing([li(T0, 1), li(T1, 2)]))).not.toContain('+2 more');
  });

  it('has nothing to say before anything has run', () => {
    expect(pipelineSummary(timing([]))).toBeNull();
  });
});
