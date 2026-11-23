import { decode } from '@/core/rv32/decode';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction, type Instruction } from '@/core/rv32/instructions';
import { formatRegister } from '@/core/rv32/operands';
import { readRegister, type CpuState } from '@/core/rv32/state';
import type { Answer, Predictor, Question } from './prediction';
import { aluEquation, branchOutcome, describeAccess, hex } from './rv32Explain';

/** The register a value question is about. A jump's link is where it came from, not a result. */
function written(instruction: Instruction): number | null {
  const decoded = decode(instruction);
  return decoded.nextPc === 'next' ? (decoded.writes[0] ?? null) : null;
}

function question(instruction: Instruction): Question | null {
  const text = formatInstruction(instruction);
  if (decode(instruction).nextPc === 'branch') return { kind: 'branch', text };
  const index = written(instruction);
  if (index === null) return null;
  return { kind: 'value', text, register: formatRegister(index), bits: 32 };
}

/** The truth is read from the instruction that ran, so it holds whatever the question said. */
function truth(asked: Question, record: ExecutionRecord, state: CpuState): Answer {
  if (asked.kind === 'value') {
    const index = written(record.instruction);
    return { kind: 'value', value: index === null ? 0 : readRegister(state, index) };
  }
  return { kind: 'branch', taken: record.comparison?.taken ?? false };
}

/** LUI uses no ALU: its immediate goes above 12 zero bits. */
function upperImmediate(record: ExecutionRecord): string | null {
  const [, upper] = record.instruction.operands;
  if (record.instruction.mnemonic !== 'lui' || upper?.type !== 'imm') return null;
  return `0x${upper.value.toString(16).toUpperCase()} << 12 = ${hex(upper.value << 12)}.`;
}

function why(asked: Question, record: ExecutionRecord): string | null {
  if (asked.kind === 'branch') return branchOutcome(record);
  // A load's ALU works out the address; the value is what came from there.
  if (record.access) return `${describeAccess(record)}.`;
  const equation = aluEquation(record);
  if (!equation) return upperImmediate(record);
  const note = equation.note ? ` (${equation.note})` : '';
  return `${equation.left} ${equation.operator} ${equation.right} = ${equation.result}${note}.`;
}

export const rv32Predictor: Predictor<Instruction, CpuState, ExecutionRecord> = {
  question,
  truth,
  why,
  formatValue: hex
};
