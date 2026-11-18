import { formatPhysical, type AddressBreakdown } from '@/core/x86/address';
import type { Decoded } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import type { MemoryAccess, PortAccess } from './describe';

/** The phase a program line is in while it is stepped one phase at a time, or null. */
type Phase = 'fetch' | 'decode' | null;

/** What the ALU box says when it has no sum to show. */
export function aluNote(
  phase: Phase,
  decoded: Decoded | null,
  record: ExecutionRecord | null,
  computedHere: boolean
): string {
  if (phase === 'fetch') return 'Waiting: the instruction is still being fetched.';
  if (decoded) {
    return decoded.usesAlu
      ? 'Selected. The operands go in when the instruction executes.'
      : `Not needed by ${decoded.mnemonic}.`;
  }
  if (!record) return 'Run an instruction to see how its result is computed.';
  return computedHere
    ? 'Computed here. The result is in the highlighted registers.'
    : `Not used by ${record.instruction.mnemonic}.`;
}

/** What the address adder says when it has no sum to show. */
export function adderNote(
  phase: Phase,
  decoded: Decoded | null,
  record: ExecutionRecord | null,
  memoryPlanned: boolean,
  usedPort: boolean
): string {
  if (phase === 'fetch') {
    return 'Idle: the program is not stored in memory here, so fetching a line forms no address.';
  }
  if (decoded) {
    if (memoryPlanned) return 'Selected. It will turn segment:offset into a 20-bit address.';
    return decoded.port
      ? 'Not needed: a port number goes onto the bus as it is.'
      : `Not needed by ${decoded.mnemonic}.`;
  }
  if (!record) return 'Turns segment:offset into the 20-bit address that goes onto the bus.';
  return usedPort
    ? 'Not used: a port number goes onto the bus as it is.'
    : `Not used: ${record.instruction.mnemonic} did not touch memory.`;
}

/** What memory or the ports will see once a decoded instruction executes. */
export function planNote(read: boolean, write: boolean): string {
  if (read && write) return 'will be read and written';
  if (write) return 'will be written';
  return read ? 'will be read' : 'not used';
}

/** What is on the external bus: the address the CPU put there, then the data that followed. */
export function busText(
  memory: MemoryAccess | null,
  address: AddressBreakdown | null,
  port: PortAccess | null
): string | null {
  if (memory && address) {
    return `address ${formatPhysical(address.physical)}h, data ${memory.value}`;
  }
  return port ? `port ${port.port}h, data ${port.value}` : null;
}
