import { decode, type Decoded } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';
import { formatHex } from '@/core/shared/numbers';
import { formatLabel } from '@/core/shared/program';
import { changedRegisters } from '@/core/x86/registers';
import type { CpuState } from '@/core/x86/state';
import type { Messages } from './messages/en';

/** The program line being stepped one phase at a time. */
export interface PendingLine {
  phase: 'fetch' | 'decode';
  line: number;
  instruction: Instruction;
}

function present(items: (string | false)[]): string[] {
  return items.filter((item): item is string => typeof item === 'string');
}

export function describeDecode(m: Messages, decoded: Decoded): string {
  const c = m.x86Cycle;
  const operands = decoded.operands
    .map((operand) =>
      c.operand(operand.text, c.roles[operand.role], m.x86Text.operandKind(operand.kind))
    )
    .join(', ');
  const names = (registers: string[]) => registers.map((name) => name.toUpperCase());
  const reads = present([
    ...names(decoded.reads),
    decoded.memory.read && c.memory,
    decoded.port === 'read' && c.port,
    decoded.readsFlags && c.flags
  ]);
  const writes = present([
    ...names(decoded.writes),
    decoded.memory.write && c.memory,
    decoded.port === 'write' && c.port,
    decoded.writesFlags && c.flags
  ]);
  return m.common.sentences([
    c.kind(
      m.x86Text.category(decoded.category),
      decoded.size,
      m.x86Text.description(decoded.mnemonic, decoded.prefix)
    ),
    operands !== '' && c.here(operands),
    reads.length > 0 && c.willRead(m.common.list(reads)),
    writes.length > 0 && c.willWrite(m.common.list(writes))
  ]);
}

export function describeExecute(m: Messages, state: CpuState, record: ExecutionRecord): string {
  const c = m.x86Cycle;
  const { registers, flags } = state;
  const changed = present([
    ...changedRegisters(record.before.registers, registers)
      .filter((name) => name !== 'ip')
      .map((name) => name.toUpperCase()),
    record.memoryWrites.length > 0 && c.memory,
    record.portWrites.length > 0 && c.port,
    flags !== record.before.flags && c.flags
  ]);
  const effect = [
    changed.length > 0 ? c.changed(m.common.list(changed)) : c.changedNothing,
    record.interrupt !== null && c.interrupt(`${formatHex(record.interrupt, 8)}h`)
  ];
  if (record.line === null) return m.common.sentences([c.direct, ...effect]);
  const next = formatLabel(registers.ip);
  const jumped = registers.ip !== record.line + 1;
  return m.common.sentences([...effect, jumped ? c.jumped(next) : c.nextLine(next)]);
}

/** What happens in the phase on show, in words; null before anything has run. */
export function describeCycle(
  m: Messages,
  state: CpuState,
  record: ExecutionRecord | null,
  pending: PendingLine | null
): string | null {
  if (pending?.phase === 'fetch') {
    return m.x86Cycle.fetch(formatLabel(pending.line), formatLabel(pending.line + 1));
  }
  if (pending) return describeDecode(m, decode(pending.instruction));
  return record ? describeExecute(m, state, record) : null;
}
