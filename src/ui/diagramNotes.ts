import { formatPhysical, type AddressBreakdown } from '@/core/x86/address';
import type { Decoded } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import type { MemoryAccess, PortAccess } from './describe';
import type { Messages } from './messages/en';

/** The phase a program line is in while it is stepped one phase at a time, or null. */
type Phase = 'fetch' | 'decode' | null;

/** What the ALU box says when it has no sum to show. */
export function aluNote(
  m: Messages,
  phase: Phase,
  decoded: Decoded | null,
  record: ExecutionRecord | null,
  computedHere: boolean
): string {
  const n = m.x86Notes;
  if (phase === 'fetch') return n.aluFetching;
  if (decoded) return decoded.usesAlu ? n.aluSelected : n.notNeeded(decoded.mnemonic);
  if (!record) return n.aluIdle;
  return computedHere ? n.aluComputed : n.notUsed(record.instruction.mnemonic);
}

/** What the address adder says when it has no sum to show. */
export function adderNote(
  m: Messages,
  phase: Phase,
  decoded: Decoded | null,
  record: ExecutionRecord | null,
  memoryPlanned: boolean,
  usedPort: boolean
): string {
  const n = m.x86Notes;
  if (phase === 'fetch') return n.adderFetching;
  if (decoded) {
    if (memoryPlanned) return n.adderSelected;
    return decoded.port ? n.portNotNeeded : n.notNeeded(decoded.mnemonic);
  }
  if (!record) return n.adderIdle;
  return usedPort ? n.portNotUsed : n.noMemory(record.instruction.mnemonic);
}

/** What memory or the ports will see once a decoded instruction executes. */
export function planNote(m: Messages, read: boolean, write: boolean): string {
  const n = m.x86Notes;
  if (read && write) return n.readWritten;
  if (write) return n.written;
  return read ? n.read : n.unused;
}

/** What is on the external bus: the address the CPU put there, then the data that followed. */
export function busText(
  m: Messages,
  memory: MemoryAccess | null,
  address: AddressBreakdown | null,
  port: PortAccess | null
): string | null {
  if (memory && address) {
    return m.x86Notes.busMemory(`${formatPhysical(address.physical)}h`, memory.value);
  }
  return port ? m.x86Notes.busPort(`${port.port}h`, port.value) : null;
}
