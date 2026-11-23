import { decode } from '@/core/mos6502/decode';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction, type Instruction, type Mnemonic } from '@/core/mos6502/instructions';
import { getFlag, type CpuState, type FlagName, type RegisterName } from '@/core/mos6502/state';
import { aluEquation, equationText, flagReason } from './mos6502Alu';
import { branchOutcome, byteHex, describeAccess } from './mos6502Explain';
import type { Answer, Predictor, Question } from './prediction';

/** Instructions that work out a result only for its flags. */
const FLAGS_ONLY = new Set<Mnemonic>(['cmp', 'cpx', 'cpy', 'bit']);

function question(instruction: Instruction): Question | null {
  const decoded = decode(instruction);
  const text = formatInstruction(instruction);
  if (decoded.nextPc === 'branch') return { kind: 'branch', text };
  if (FLAGS_ONLY.has(decoded.mnemonic)) {
    return { kind: 'flags', text, flags: decoded.flagsWritten };
  }
  // The stack pointer moves by itself: the register an instruction names is the one to ask for.
  const written = decoded.writes.find((name) => name !== 'sp');
  if (!written || decoded.nextPc === 'jump') return null;
  return { kind: 'value', text, register: written.toUpperCase(), key: written, bits: 8 };
}

function truth(asked: Question, record: ExecutionRecord, state: CpuState): Answer {
  switch (asked.kind) {
    case 'branch':
      return { kind: 'branch', taken: record.branch?.taken ?? false };
    case 'value':
      return { kind: 'value', value: state.registers[asked.key as RegisterName] };
    case 'flags':
      return {
        kind: 'flags',
        on: asked.flags.filter((flag) => getFlag(state, flag as FlagName))
      };
  }
}

function why(
  asked: Question,
  record: ExecutionRecord,
  _state: CpuState,
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
        wrong
          .map((flag) => `${flag}: ${flagReason(record, flag as FlagName) ?? 'left as it was'}.`)
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
