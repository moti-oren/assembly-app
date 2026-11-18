import {
  redoPortWrite,
  undoPortWrite,
  type CpuSnapshot,
  type CpuState,
  type MemoryWrite,
  type PortWrite
} from './state';

/**
 * Everything needed to undo one executed instruction, on any architecture. An architecture adds
 * what it needs to explain the instruction afterwards, such as what its ALU computed.
 */
export interface ExecutionRecord<Instruction = unknown, Register extends string = string> {
  instruction: Instruction;
  /** The program line it was fetched from, or null when it was run directly. */
  line: number | null;
  before: CpuSnapshot<Register>;
  memoryWrites: MemoryWrite[];
  /** Bytes written to output ports. */
  portWrites: PortWrite[];
  /**
   * Registers the instruction wrote, whether or not the value changed, each once. The fetch
   * moving the instruction pointer to the next line is not one of them.
   */
  registersWritten: string[];
}

export function undo(state: CpuState, record: ExecutionRecord): void {
  Object.assign(state.registers, record.before.registers);
  state.flags = record.before.flags;
  for (let i = record.memoryWrites.length - 1; i >= 0; i--) {
    const write = record.memoryWrites[i];
    state.memory[write.address] = write.before;
  }
  if (record.memoryWrites.length > 0) {
    state.memoryVersion++;
  }
  for (let i = record.portWrites.length - 1; i >= 0; i--) {
    undoPortWrite(state, record.portWrites[i]);
  }
}

/** Re-applies an undone record without running it again: the inverse of `undo`. */
export function redo(state: CpuState, record: ExecutionRecord, after: CpuSnapshot): void {
  Object.assign(state.registers, after.registers);
  state.flags = after.flags;
  for (const write of record.memoryWrites) {
    state.memory[write.address] = write.after;
  }
  if (record.memoryWrites.length > 0) {
    state.memoryVersion++;
  }
  for (const write of record.portWrites) {
    redoPortWrite(state, write);
  }
}
