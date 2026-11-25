import { formatLabel, type Program } from '@/core/shared/program';
import { s32 } from '@/core/rv32/bits';
import { decode, type Decoded } from '@/core/rv32/decode';
import { wordAt } from '@/core/rv32/encode';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction, type Instruction } from '@/core/rv32/instructions';
import { formatRegister } from '@/core/rv32/operands';
import { addressOfLine, lineAt, readRegister, type CpuState } from '@/core/rv32/state';
import { aluEquation, describeAccess, describeComparison, hex } from './rv32Explain';

/** How a stage or a register took part: read, written, or not at all. */
export type Use = 'read' | 'write' | undefined;

export interface StageView {
  use: Use;
  /** One line of what the stage did, or what it is about to do. */
  text: string;
}

/** The single-cycle datapath as the diagram shows it, for one instruction. */
export interface DatapathView {
  /** The instruction on show, as written, or null when the CPU is idle. */
  instruction: string | null;
  fetch: StageView;
  decode: StageView & { fields: { name: string; value: string }[] };
  execute: StageView;
  memory: StageView;
  writeBack: StageView;
  nextPc: StageView;
  /** Register numbers the instruction reads, and the ones it wrote. */
  reads: number[];
  writes: number[];
}

export interface DatapathInput {
  state: CpuState;
  program: Program<Instruction>;
  record: ExecutionRecord | null;
  /** A program line part-way through its cycle, which has not run yet. */
  pending: { phase: 'fetch' | 'decode'; line: number; instruction: Instruction } | null;
}

const IDLE: StageView = { use: undefined, text: 'idle' };

function fields(decoded: Decoded): { name: string; value: string }[] {
  const list: { name: string; value: string }[] = [{ name: 'format', value: decoded.format }];
  if (decoded.rd !== null) list.push({ name: 'rd', value: formatRegister(decoded.rd) });
  if (decoded.rs1 !== null) list.push({ name: 'rs1', value: formatRegister(decoded.rs1) });
  if (decoded.rs2 !== null) list.push({ name: 'rs2', value: formatRegister(decoded.rs2) });
  if (decoded.immediate !== null) list.push({ name: 'imm', value: String(s32(decoded.immediate)) });
  return list;
}

function fetchStage(input: DatapathInput, line: number | null): StageView {
  if (line === null) return { use: undefined, text: 'run directly: nothing fetched' };
  const word = line < input.program.length ? hex(wordAt(input.program, line)) : '';
  return { use: 'read', text: `PC ${hex(addressOfLine(line))} → ${formatLabel(line)}: ${word}` };
}

const SOURCES: Record<NonNullable<Decoded['writeBack']>, string> = {
  alu: "the ALU's result",
  memory: 'the loaded value',
  link: 'the link, PC + 4',
  immediate: 'the upper immediate'
};

/** What the stages will do, worked out from the instruction alone. */
function planned(
  decoded: Decoded
): Pick<DatapathView, 'execute' | 'memory' | 'writeBack' | 'nextPc'> {
  const { alu, memory, writeBack, rd, nextPc } = decoded;
  const input = (name: string) => (name === 'pc' ? 'PC' : name);
  return {
    execute: alu
      ? { use: 'read', text: `A = ${input(alu.a)}, B = ${alu.b === 'rs2' ? 'rs2' : 'imm'}` }
      : IDLE,
    memory: memory ? { use: 'read', text: `will ${memory.access}` } : IDLE,
    writeBack:
      writeBack && rd !== 0 && rd !== null
        ? { use: 'read', text: `${formatRegister(rd)} ← ${SOURCES[writeBack]}` }
        : IDLE,
    nextPc: {
      use: 'read',
      text:
        nextPc === 'branch' ? 'depends on the comparison' : nextPc === 'jump' ? 'jumps' : 'PC + 4'
    }
  };
}

/** What the stages did, from the record of the instruction that ran. */
function executed(
  input: DatapathInput,
  record: ExecutionRecord,
  decoded: Decoded
): Pick<DatapathView, 'execute' | 'memory' | 'writeBack' | 'nextPc'> {
  const equation = aluEquation(record);
  const access = describeAccess(record);
  const comparison = describeComparison(record, input.state, input.program);
  const { pc } = input.state.registers;
  const line = lineAt(pc, input.program.length);
  const at = line === null ? hex(pc) : `${hex(pc)} (${formatLabel(line)})`;
  const written = decoded.writes[0];
  return {
    execute: equation
      ? {
          // Orange only where the ALU's result is written to a register; an address it worked
          // out for a load or a store is read on, not kept, and a result for x0 is thrown away.
          use: decoded.writeBack === 'alu' && written !== undefined ? 'write' : 'read',
          text: `${equation.left} ${equation.operator} ${equation.right} = ${equation.result}`
        }
      : comparison
        ? // A branch subtracts its registers and keeps only what the comparison needs.
          { use: 'read', text: `${comparison.left} − ${comparison.right}, ${comparison.how}` }
        : IDLE,
    memory: access ? { use: record.access?.write ? 'write' : 'read', text: access } : IDLE,
    writeBack:
      written !== undefined && decoded.writeBack
        ? {
            use: 'write',
            text: `${formatRegister(written)} ← ${hex(readRegister(input.state, written))}, ${SOURCES[decoded.writeBack]}`
          }
        : IDLE,
    nextPc: comparison
      ? {
          use: comparison.taken ? 'write' : 'read',
          // A question and its answer: `t0 (0) ≠ zero (0)? No: on to …` read as one claim.
          text: `${comparison.left} ${comparison.operator} ${comparison.right}? ${comparison.taken ? 'Yes: jumps to' : 'No: on to'} ${at}`
        }
      : { use: decoded.nextPc === 'jump' ? 'write' : 'read', text: `PC = ${at}` }
  };
}

export function datapathView(input: DatapathInput): DatapathView {
  const { record, pending } = input;
  const instruction = pending?.instruction ?? record?.instruction ?? null;
  if (!instruction) {
    return {
      instruction: null,
      fetch: IDLE,
      decode: { ...IDLE, fields: [] },
      execute: IDLE,
      memory: IDLE,
      writeBack: IDLE,
      nextPc: IDLE,
      reads: [],
      writes: []
    };
  }
  const decoded = decode(instruction);
  const line = pending ? pending.line : (record?.line ?? null);
  const fetch = fetchStage(input, line);
  // Fetch only reads the word at PC; the control unit knows nothing more yet.
  if (pending?.phase === 'fetch') {
    return {
      instruction: formatInstruction(instruction),
      fetch,
      decode: { ...IDLE, fields: [] },
      execute: IDLE,
      memory: IDLE,
      writeBack: IDLE,
      nextPc: IDLE,
      reads: [],
      writes: []
    };
  }
  const stages = pending ? planned(decoded) : executed(input, record!, decoded);
  return {
    instruction: formatInstruction(instruction),
    fetch,
    decode: { use: 'read', text: decoded.description, fields: fields(decoded) },
    ...stages,
    reads: decoded.reads,
    writes: pending ? [] : decoded.writes
  };
}
