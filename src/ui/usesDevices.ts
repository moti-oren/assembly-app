import { decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';

/** On the 8086 the devices are behind ports, so IN and OUT are the instructions that use them. */
export function x86UsesDevices(
  program: readonly Instruction[],
  last: ExecutionRecord | null
): boolean {
  const usesPort = (instruction: Instruction) => decode(instruction).port !== null;
  return program.some(usesPort) || (last !== null && usesPort(last.instruction));
}
