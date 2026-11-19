import { formatLabel, type Program } from '@/core/shared/program';
import { s32 } from '@/core/rv32/bits';
import { decode, type Decoded } from '@/core/rv32/decode';
import { wordAt } from '@/core/rv32/encode';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction, type Instruction } from '@/core/rv32/instructions';
import { formatRegister } from '@/core/rv32/operands';
import { addressOfLine, lineAt, readRegister, type CpuState } from '@/core/rv32/state';
import type { Messages } from './messages/en';
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

const idle = (m: Messages): StageView => ({ use: undefined, text: m.datapath.idle });

function fields(decoded: Decoded): { name: string; value: string }[] {
  const list: { name: string; value: string }[] = [{ name: 'format', value: decoded.format }];
  if (decoded.rd !== null) list.push({ name: 'rd', value: formatRegister(decoded.rd) });
  if (decoded.rs1 !== null) list.push({ name: 'rs1', value: formatRegister(decoded.rs1) });
  if (decoded.rs2 !== null) list.push({ name: 'rs2', value: formatRegister(decoded.rs2) });
  if (decoded.immediate !== null) list.push({ name: 'imm', value: String(s32(decoded.immediate)) });
  return list;
}

function fetchStage(m: Messages, input: DatapathInput, line: number | null): StageView {
  if (line === null) return { use: undefined, text: m.datapath.direct };
  const word = line < input.program.length ? hex(wordAt(input.program, line)) : '';
  return { use: 'read', text: `PC ${hex(addressOfLine(line))} → ${formatLabel(line)}: ${word}` };
}

/** What the stages will do, worked out from the instruction alone. */
function planned(
  m: Messages,
  decoded: Decoded
): Pick<DatapathView, 'execute' | 'memory' | 'writeBack' | 'nextPc'> {
  const { alu, memory, writeBack, rd, nextPc } = decoded;
  const IDLE = idle(m);
  const input = (name: string) => (name === 'pc' ? 'PC' : name);
  return {
    execute: alu
      ? { use: 'read', text: `A = ${input(alu.a)}, B = ${alu.b === 'rs2' ? 'rs2' : 'imm'}` }
      : IDLE,
    memory: memory ? { use: 'read', text: m.datapath.willAccess(memory.access) } : IDLE,
    writeBack:
      writeBack && rd !== 0 && rd !== null
        ? { use: 'read', text: `${formatRegister(rd)} ← ${m.datapath.sources[writeBack]}` }
        : IDLE,
    nextPc: {
      use: 'read',
      text:
        nextPc === 'branch' ? m.datapath.depends : nextPc === 'jump' ? m.datapath.jumps : 'PC + 4'
    }
  };
}

/** What the stages did, from the record of the instruction that ran. */
function executed(
  m: Messages,
  input: DatapathInput,
  record: ExecutionRecord,
  decoded: Decoded
): Pick<DatapathView, 'execute' | 'memory' | 'writeBack' | 'nextPc'> {
  const IDLE = idle(m);
  const equation = aluEquation(m, record);
  const access = describeAccess(m, record);
  const comparison = describeComparison(m, record, input.state, input.program);
  const { pc } = input.state.registers;
  const line = lineAt(pc, input.program.length);
  const at = line === null ? hex(pc) : `${hex(pc)} (${formatLabel(line)})`;
  const written = decoded.writes[0];
  return {
    execute: equation
      ? {
          use: 'write',
          text: `${equation.left} ${equation.operator} ${equation.right} = ${equation.result}`
        }
      : IDLE,
    memory: access ? { use: record.access?.write ? 'write' : 'read', text: access } : IDLE,
    writeBack:
      written !== undefined && decoded.writeBack
        ? {
            use: 'write',
            text: `${formatRegister(written)} ← ${hex(readRegister(input.state, written))}, ${m.datapath.sources[decoded.writeBack]}`
          }
        : IDLE,
    nextPc: comparison
      ? {
          use: comparison.taken ? 'write' : 'read',
          text: `${comparison.left} ${comparison.operator} ${comparison.right}: ${comparison.outcome}`
        }
      : { use: decoded.nextPc === 'jump' ? 'write' : 'read', text: `PC = ${at}` }
  };
}

export function datapathView(m: Messages, input: DatapathInput): DatapathView {
  const { record, pending } = input;
  const IDLE = idle(m);
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
  const fetch = fetchStage(m, input, line);
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
  const stages = pending ? planned(m, decoded) : executed(m, input, record!, decoded);
  return {
    instruction: formatInstruction(instruction),
    fetch,
    decode: {
      use: 'read',
      text: m.rv32Text.description(instruction.mnemonic),
      fields: fields(decoded)
    },
    ...stages,
    reads: decoded.reads,
    writes: pending ? [] : decoded.writes
  };
}
