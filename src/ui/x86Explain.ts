import { OPERAND_KIND_LABELS, decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import { CATEGORY_LABELS, type Instruction } from '@/core/x86/instructions';
import { formatHex } from '@/core/shared/numbers';
import { formatLabel } from '@/core/shared/program';
import { changedRegisters } from '@/core/x86/registers';
import type { CpuState } from '@/core/x86/state';

function list(items: (string | false)[]): string {
  return items.filter(Boolean).join(', ');
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
  const reads = list([
    ...names(decoded.reads),
    decoded.memory.read && 'memory',
    decoded.port === 'read' && 'an I/O port',
    decoded.readsFlags && 'the flags'
  ]);
  const writes = list([
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

/** What the instruction did, given the CPU right after it. */
export function describeExecute(record: ExecutionRecord, state: CpuState): string {
  const { registers, flags } = state;
  const changed = list([
    ...changedRegisters(record.before.registers, registers)
      .filter((name) => name !== 'ip')
      .map((name) => name.toUpperCase()),
    record.memoryWrites.length > 0 && 'memory',
    record.portWrites.length > 0 && 'an I/O port',
    flags !== record.before.flags && 'the flags'
  ]);
  const interrupt =
    record.interrupt === null ? '' : ` It entered interrupt ${formatHex(record.interrupt, 8)}h.`;
  const effect =
    (changed ? `It changed ${changed}.` : 'It changed no register, flag or memory.') + interrupt;
  if (record.line === null) {
    return `Run directly, so nothing was fetched from the program. ${effect}`;
  }
  const next = formatLabel(registers.ip);
  const jumped = registers.ip !== record.line + 1;
  return `${effect} ${jumped ? `It jumped: IP is now ${next}.` : `IP is at ${next}, the next line.`}`;
}
