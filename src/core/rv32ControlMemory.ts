import type { ControlMemory } from './controlLink';
import { CpuError } from './shared/cpuError';
import type { Program } from './shared/program';
import { u32 } from './rv32/bits';
import type { ExecutionRecord } from './rv32/execute';
import type { Instruction } from './rv32/instructions';
import { load, storeFault, type AccessSize } from './rv32/memory';
import type { CpuState } from './rv32/state';

/**
 * Memory as an instruction found it. What the instruction itself loaded is the value its record
 * kept; anything else is read from the CPU as that instruction left it, with the bytes it wrote
 * given their old values back. Nothing is written, so a store only says whether it would trap.
 */
export function memoryBefore(
  state: CpuState,
  program: Program<Instruction>,
  record: ExecutionRecord
): ControlMemory {
  const old = new Map(record.memoryWrites.map((write) => [write.address, write.before]));
  const byteAt = (now: number, address: number, at: number): number =>
    old.get(address + at) ?? (now >>> (8 * at)) & 0xff;
  const { access } = record;
  const loaded = access && !access.write ? access : null;
  return {
    read: (address, size) => {
      if (loaded && loaded.address === address && loaded.size === size) return loaded.value;
      try {
        const now = load(state, program, address, size as AccessSize);
        const bytes = Array.from({ length: size }, (_, at) => byteAt(now, address, at));
        return u32(bytes.reduce((value, byte, at) => value | (byte << (8 * at)), 0));
      } catch (error) {
        if (error instanceof CpuError) return { fault: error.message };
        throw error;
      }
    },
    storeFault: (address, size) => storeFault(program, address, size as AccessSize)
  };
}
