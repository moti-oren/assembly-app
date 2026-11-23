import { decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import { explainFlag } from '@/core/x86/flagReasons';
import { isFlagSet, type FlagName } from '@/core/x86/flags';
import { formatInstruction, type Instruction, type Mnemonic } from '@/core/x86/instructions';
import { formatHex, type Size } from '@/core/shared/numbers';
import { operandSize } from '@/core/x86/operands';
import type { RegisterName } from '@/core/x86/registers';
import { readRegister, type CpuState } from '@/core/x86/state';
import { describeEquation } from './describe';
import type { Answer, Predictor, Question } from './prediction';
import { jumpOutcome } from './x86Explain';
import { JUMP_RULES } from './x86Jumps';

/** The flags a comparison is read from; AF and PF are left to the flags panel. */
const COMPARED: FlagName[] = ['CF', 'ZF', 'SF', 'OF'];

/** Instructions that work out a result only for its flags. */
const FLAGS_ONLY = new Set<Mnemonic>(['cmp', 'test']);

function question(instruction: Instruction): Question | null {
  const { mnemonic } = instruction;
  const text = formatInstruction(instruction);
  if (JUMP_RULES[mnemonic]) return { kind: 'branch', text };
  if (FLAGS_ONLY.has(mnemonic)) return { kind: 'flags', text, flags: COMPARED };
  const [destination] = instruction.operands;
  const [first] = decode(instruction).operands;
  if (destination?.type !== 'reg' || first.role !== 'destination') return null;
  return {
    kind: 'value',
    text,
    register: destination.name.toUpperCase(),
    key: destination.name,
    bits: operandSize(destination) ?? 16
  };
}

function truth(asked: Question, record: ExecutionRecord, state: CpuState): Answer {
  switch (asked.kind) {
    case 'branch': {
      // No jump writes a flag, and the LOOPs test CX after counting it down: the CX there is now.
      const flag = (name: FlagName) => isFlagSet(record.before.flags, name);
      const rule = JUMP_RULES[record.instruction.mnemonic]!;
      return { kind: 'branch', taken: rule.holds(flag, state.registers.cx) };
    }
    case 'value':
      return { kind: 'value', value: readRegister(state, asked.key as RegisterName) };
    case 'flags':
      return {
        kind: 'flags',
        on: asked.flags.filter((flag) => isFlagSet(state.flags, flag as FlagName))
      };
  }
}

function equation(record: ExecutionRecord, state: CpuState): string | null {
  const found = describeEquation(state, record);
  if (!found) return null;
  const carry = found.carry === null ? '' : ` ${found.operator} ${found.carry} (CF)`;
  return `${found.left} ${found.operator} ${found.right}${carry} = ${found.result}.`;
}

function why(
  asked: Question,
  record: ExecutionRecord,
  state: CpuState,
  wrong: readonly string[]
): string | null {
  switch (asked.kind) {
    case 'branch':
      return jumpOutcome(record, state);
    case 'value':
      return equation(record, state);
    case 'flags':
      return (
        wrong.map((flag) => `${flag}: ${explainFlag(record, flag as FlagName).text}`).join(' ') ||
        null
      );
  }
}

export const x86Predictor: Predictor<Instruction, CpuState, ExecutionRecord> = {
  question,
  truth,
  why,
  formatValue: (value, bits) => formatHex(value, bits as Size)
};
