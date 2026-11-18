import type { Architecture } from './shared/architecture';
import type { ExecutionRecord } from './shared/executionRecord';
import { runToEnd, type Program, type ProgramInstruction } from './shared/program';
import type { CpuState } from './shared/state';
import type { ComparisonTask, Solution } from './comparisonTasks';
import { MOS6502 } from './mos6502/architecture';
import { assemble as assembleMos6502 } from './mos6502/encode';
import { formatInstruction as formatMos6502 } from './mos6502/instructions';
import { RV32 } from './rv32/architecture';
import { assemble as assembleRv32 } from './rv32/encode';
import { formatInstruction as formatRv32 } from './rv32/instructions';
import { X86 } from './x86/architecture';
import { assemble as assembleX86 } from './x86/encode';
import { formatInstruction as formatX86 } from './x86/instructions';

/** The architectures a task is written for, by their ids. */
export type ComparedId = 'x86' | 'rv32' | 'mos6502';

/** One line of a program, as the comparison lists it: the assembly and its machine code. */
export interface ListedLine {
  text: string;
  bytes: readonly number[];
}

/** What running one architecture's program for a task took. */
export interface Measurement {
  listing: ListedLine[];
  /** The size of the machine code. */
  bytes: number;
  /** Instructions executed. A REP string instruction counts once, however often it repeats. */
  steps: number;
  /** Bytes written to memory, the stack included; device writes are not counted. */
  memoryWrites: number;
  /** Clock cycles, where the core counts them: only the 6502's does. */
  cycles: number | null;
  result: string;
  error: string | null;
}

interface Measurer<I extends ProgramInstruction, S extends CpuState, R extends ExecutionRecord<I>> {
  cpu: Architecture<I, S, R>;
  format: (instruction: I) => string;
  assemble: (program: Program<I>) => {
    lines: { encoding: { bytes: readonly number[] } }[];
    size: number;
  };
  cycles: (records: readonly R[]) => number | null;
}

function measureWith<
  I extends ProgramInstruction,
  S extends CpuState,
  R extends ExecutionRecord<I>
>(
  { cpu, format, assemble, cycles }: Measurer<I, S, R>,
  { program, result }: Solution<I, S>
): Measurement {
  const state = cpu.createState();
  const run = runToEnd(cpu, state, program);
  const { lines, size } = assemble(program);
  return {
    listing: program.map((instruction, line) => ({
      text: format(instruction),
      bytes: lines[line].encoding.bytes
    })),
    bytes: size,
    steps: run.records.length,
    memoryWrites: run.records.reduce((sum, record) => sum + record.memoryWrites.length, 0),
    cycles: cycles(run.records),
    result: result(state),
    error: run.error?.message ?? null
  };
}

/** Runs each architecture's program for the task from a fresh CPU, and measures what it took. */
export function measure(task: ComparisonTask): Record<ComparedId, Measurement> {
  return {
    x86: measureWith(
      { cpu: X86, format: formatX86, assemble: assembleX86, cycles: () => null },
      task.x86
    ),
    rv32: measureWith(
      { cpu: RV32, format: formatRv32, assemble: assembleRv32, cycles: () => null },
      task.rv32
    ),
    mos6502: measureWith(
      {
        cpu: MOS6502,
        format: formatMos6502,
        assemble: assembleMos6502,
        cycles: (records) => records.reduce((sum, record) => sum + record.cycles, 0)
      },
      task.mos6502
    )
  };
}
