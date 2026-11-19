import type { Program } from '@/core/shared/program';
import { decode } from '@/core/mos6502/decode';
import { codeByte } from '@/core/mos6502/encode';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction, type Instruction } from '@/core/mos6502/instructions';
import { addressOfLine } from '@/core/mos6502/layout';
import type { RegisterName } from '@/core/mos6502/state';
import { aluEquation, equationText } from './mos6502Alu';
import {
  addressingMode,
  addressSteps,
  byteHex,
  cyclesBreakdown,
  describeAccess,
  wordHex
} from './mos6502Explain';
import type { Messages } from './messages/en';

/** How a part of the CPU took part: read, written, or not at all. */
export type Use = 'read' | 'write' | undefined;

export interface UnitView {
  use: Use;
  text: string;
}

/** The 6502 as the diagram shows it, for one instruction. */
export interface Mos6502DiagramView {
  instruction: string | null;
  registers: Partial<Record<RegisterName, Use>>;
  alu: UnitView;
  /** How the address was formed: the mode, then its steps. */
  address: UnitView & { mode: string | null };
  bus: UnitView;
  cycles: { count: number; text: string } | null;
}

export interface DiagramInput {
  program: Program<Instruction>;
  record: ExecutionRecord | null;
  pending: { phase: 'fetch' | 'decode'; line: number; instruction: Instruction } | null;
}

const unused = (m: Messages): UnitView => ({ use: undefined, text: m.mos6502Diagram.idle });

function idle(m: Messages, instruction: Instruction | null): Mos6502DiagramView {
  const IDLE = unused(m);
  return {
    instruction: instruction && formatInstruction(instruction),
    registers: {},
    alu: IDLE,
    address: { ...IDLE, mode: null },
    bus: IDLE,
    cycles: null
  };
}

/** Fetch reads the opcode at PC; nothing else has happened yet. */
function fetching(
  m: Messages,
  program: Program<Instruction>,
  line: number,
  instruction: Instruction
) {
  const address = addressOfLine(program, line);
  return {
    ...idle(m, instruction),
    registers: { pc: 'read' as const },
    bus: {
      use: 'read' as const,
      text: m.mos6502Diagram.readOpcode(byteHex(codeByte(program, address)), wordHex(address))
    }
  };
}

/** Decode knows the mode, the registers it will use and whether it goes to memory. */
function planned(m: Messages, instruction: Instruction): Mos6502DiagramView {
  const d = m.mos6502Diagram;
  const IDLE = unused(m);
  const decoded = decode(instruction);
  const registers: Partial<Record<RegisterName, Use>> = {};
  for (const name of decoded.reads) registers[name] = 'read';
  const memory = decoded.memory.read || decoded.memory.write;
  const aluUsed = decoded.flagsWritten.some((flag) => 'NZCV'.includes(flag));
  return {
    instruction: decoded.text,
    registers,
    alu: aluUsed ? { use: 'read', text: d.willSet(m.common.list(decoded.flagsWritten)) } : IDLE,
    address: memory
      ? { use: 'read', text: d.willAddress, mode: decoded.modeName }
      : { ...IDLE, mode: null },
    bus: memory ? { use: 'read', text: decoded.memory.write ? d.willWrite : d.willRead } : IDLE,
    cycles: null
  };
}

function executed(m: Messages, record: ExecutionRecord): Mos6502DiagramView {
  const IDLE = unused(m);
  const decoded = decode(record.instruction);
  const registers: Partial<Record<RegisterName, Use>> = {};
  for (const name of decoded.reads) registers[name] = 'read';
  for (const name of record.registersWritten) registers[name as RegisterName] = 'write';
  if (decoded.nextPc !== 'next') registers.pc = 'write';
  const equation = aluEquation(m, record);
  const access = describeAccess(m, record);
  return {
    instruction: formatInstruction(record.instruction),
    registers,
    alu: equation ? { use: 'write', text: equationText(m, equation) } : IDLE,
    address: record.addressing
      ? { use: 'read', text: addressSteps(m, record.addressing), mode: addressingMode(record) }
      : { ...IDLE, mode: null },
    bus: access ? { use: record.access!.write ? 'write' : 'read', text: access } : IDLE,
    cycles: { count: record.cycles, text: cyclesBreakdown(m, record) }
  };
}

export function diagramView(
  m: Messages,
  { program, record, pending }: DiagramInput
): Mos6502DiagramView {
  if (pending?.phase === 'fetch') return fetching(m, program, pending.line, pending.instruction);
  if (pending) return planned(m, pending.instruction);
  return record ? executed(m, record) : idle(m, null);
}
