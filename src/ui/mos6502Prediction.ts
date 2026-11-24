import { decode } from '@/core/mos6502/decode';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction, type Instruction, type Mnemonic } from '@/core/mos6502/instructions';
import { getFlag, type CpuState, type RegisterName } from '@/core/mos6502/state';
import { aluEquation, equationText, flagReason } from './mos6502Alu';
import { branchOutcome, byteHex, describeAccess } from './mos6502Explain';
import type { Answer, Predictor, Question } from './prediction';

/** Instructions that work out a result only for its flags. */
const FLAGS_ONLY = new Set<Mnemonic>(['cmp', 'cpx', 'cpy', 'bit']);

/**
 * The register a value question is about. The stack pointer moves by itself: the register an
 * instruction names is the one to ask for.
 */
function written(instruction: Instruction): RegisterName | null {
  const decoded = decode(instruction);
  if (decoded.nextPc !== 'next') return null;
  return decoded.writes.find((name) => name !== 'sp') ?? null;
}

function question(instruction: Instruction): Question | null {
  const decoded = decode(instruction);
  const text = formatInstruction(instruction);
  if (decoded.nextPc === 'branch') return { kind: 'branch', text };
  if (FLAGS_ONLY.has(decoded.mnemonic)) {
    return { kind: 'flags', text, flags: decoded.flagsWritten };
  }
  const name = written(instruction);
  return name && { kind: 'value', text, register: name.toUpperCase(), bits: 8 };
}

/** The truth is read from the instruction that ran, so it holds whatever the question said. */
function truth(asked: Question, record: ExecutionRecord, state: CpuState): Answer {
  switch (asked.kind) {
    case 'branch':
      return { kind: 'branch', taken: record.branch?.taken ?? false };
    case 'value': {
      const name = written(record.instruction);
      return { kind: 'value', value: name ? state.registers[name] : 0 };
    }
    case 'flags': {
      const flags = decode(record.instruction).flagsWritten;
      return { kind: 'flags', on: flags.filter((flag) => getFlag(state, flag)) };
    }
  }
}

function why(
  asked: Question,
  record: ExecutionRecord,
  state: CpuState,
  wrong: readonly string[]
): string | null {
  switch (asked.kind) {
    case 'branch':
      return branchOutcome(record);
    case 'value': {
      const equation = aluEquation(record);
      if (equation) return `${equationText(equation)}.`;
      const access = describeAccess(record);
      return access && `${access}.`;
    }
    case 'flags':
      return (
        decode(record.instruction)
          .flagsWritten.filter((flag) => wrong.includes(flag))
          .map((flag) => `${flag}: ${flagReason(record, flag, state) ?? 'left as it was'}.`)
          .join(' ') || null
      );
  }
}

export const mos6502Predictor: Predictor<Instruction, CpuState, ExecutionRecord> = {
  question,
  truth,
  why,
  formatValue: byteHex
};
