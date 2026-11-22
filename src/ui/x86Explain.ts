import { OPERAND_KIND_LABELS, decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import { isFlagSet, type FlagName } from '@/core/x86/flags';
import { CATEGORY_LABELS, type Instruction } from '@/core/x86/instructions';
import { formatHex } from '@/core/shared/numbers';
import { formatLabel } from '@/core/shared/program';
import { changedRegisters } from '@/core/x86/registers';
import type { CpuState } from '@/core/x86/state';
import { describeBranch, list } from './explainText';
import { JUMP_RULES } from './x86Jumps';

/** The items that apply, as a sentence lists them. */
function listed(items: (string | false)[]): string {
  return list(items.filter((item): item is string => typeof item === 'string'));
}

export function describeFetch(line: number): string {
  return `IP points at ${formatLabel(line)}. That line is read out of the program, and IP moves on to ${formatLabel(line + 1)} before anything runs.`;
}

export function describeDecode(instruction: Instruction): string {
  const decoded = decode(instruction);
  const size = decoded.size ? `, ${decoded.size}-bit` : '';
  const operands = decoded.operands
    .map(
      (operand) => `${operand.text} is the ${operand.role} (${OPERAND_KIND_LABELS[operand.kind]})`
    )
    .join(', ');
  const names = (registers: string[]) => registers.map((name) => name.toUpperCase());
  const reads = listed([
    ...names(decoded.reads),
    decoded.memory.read && 'memory',
    decoded.port === 'read' && 'an I/O port',
    decoded.readsFlags && 'the flags'
  ]);
  const writes = listed([
    ...names(decoded.writes),
    decoded.memory.write && 'memory',
    decoded.port === 'write' && 'an I/O port',
    decoded.writesFlags && 'the flags'
  ]);
  return [
    `${CATEGORY_LABELS[decoded.category]}${size}: ${decoded.description}.`,
    operands && `Here ${operands}.`,
    reads && `It will read ${reads}.`,
    writes && `It will write ${writes}.`
  ]
    .filter(Boolean)
    .join(' ');
}

function sentences(sentences: (string | false | null)[]): string {
  return sentences.filter(Boolean).join(' ');
}

/** Why a conditional jump was taken or not; null for any other instruction. */
function jumpOutcome(record: ExecutionRecord, state: CpuState): string | null {
  const { mnemonic } = record.instruction;
  const rule = JUMP_RULES[mnemonic];
  if (!rule) return null;
  // No jump writes a flag, and the LOOPs test CX after counting it down: the CX there is now.
  const flag = (name: FlagName) => isFlagSet(record.before.flags, name);
  const { cx } = state.registers;
  return describeBranch({
    name: mnemonic.toUpperCase(),
    verb: 'jumps',
    when: rule.when,
    values: [
      ...(rule.cx ? [`CX is ${cx}`] : []),
      ...rule.flags.map((name) => `${name} is ${flag(name) ? 1 : 0}`)
    ],
    taken: rule.holds(flag, cx)
  });
}

/** What the instruction did, given the CPU right after it. */
export function describeExecute(record: ExecutionRecord, state: CpuState): string {
  const { registers, flags } = state;
  const changed = listed([
    ...changedRegisters(record.before.registers, registers)
      .filter((name) => name !== 'ip')
      .map((name) => name.toUpperCase()),
    record.memoryWrites.length > 0 && 'memory',
    record.portWrites.length > 0 && 'an I/O port',
    flags !== record.before.flags && 'the flags'
  ]);
  const outcome = jumpOutcome(record, state);
  // A jump that changed nothing has its outcome to say instead.
  const nothing = outcome ? '' : 'It changed no register, flag or memory.';
  const effect = sentences([
    changed ? `It changed ${changed}.` : nothing,
    record.interrupt !== null && `It entered interrupt ${formatHex(record.interrupt, 8)}h.`,
    outcome
  ]);
  const next = formatLabel(registers.ip);
  const moved = outcome ? `IP is now ${next}.` : `It jumped: IP is now ${next}.`;
  if (record.line === null) {
    const jumped = registers.ip !== record.before.registers.ip;
    return sentences(['Ran directly (not from the program).', effect, jumped && moved]);
  }
  const jumped = registers.ip !== record.line + 1;
  return `${effect} ${jumped ? moved : `IP is at ${next}, the next line.`}`;
}
