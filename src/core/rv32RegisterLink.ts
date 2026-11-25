import { NOT_KEPT, written, type RegisterFileView, type RegisterLink } from './registerLink';
import { decode } from './rv32/decode';
import { encodeAt } from './rv32/encode';
import type { ExecutionRecord } from './rv32/execute';
import { formatRegister } from './rv32/operands';
import { u32 } from './rv32/bits';
import { REGISTER_KEYS, ZERO } from './rv32/registers';
import { addressOfLine, INSTRUCTION_SIZE, type CpuState } from './rv32/state';

type Snapshot = Pick<CpuState, 'registers'>;

const NAMES = REGISTER_KEYS.map((_, index) => formatRegister(index));

/**
 * The value the instruction sent to the registers. A register that kept it holds it now; x0 kept
 * nothing, so there it is worked out from where the value came from, or unknown for a value
 * loaded from memory, which the record keeps only before its sign is extended.
 */
function sent(record: ExecutionRecord, after: Snapshot, rd: number): number | null {
  if (rd !== ZERO) return after.registers[REGISTER_KEYS[rd]];
  const { writeBack, immediate } = decode(record.instruction);
  if (writeBack === 'alu') return record.alu?.result ?? null;
  if (writeBack === 'immediate') return immediate;
  // The link is the address after this instruction, which only one fetched from the program has.
  if (writeBack === 'link' && record.line !== null) {
    return u32(record.before.registers.pc + INSTRUCTION_SIZE);
  }
  return null;
}

/**
 * The 32 registers as the instruction found them, with rd as the address it wrote to. One with
 * no rd (a store, a branch) still meets the file, with its write line off: the decoder reads
 * bits 11 to 7 of its word as an address all the same, and the input carries what the ALU made.
 */
function fileOf(record: ExecutionRecord, after: Snapshot): RegisterFileView | undefined {
  const { rd } = decode(record.instruction);
  const held = REGISTER_KEYS.map((key) => record.before.registers[key]);
  const file = (input: number, address: number, write: 0 | 1): RegisterFileView => ({
    names: NAMES,
    request: { width: 32, held, input, address, write, zeroWired: true }
  });
  if (rd === null) {
    // Encoded where it ran from, as the control topic encodes it: a branch's bits 11 to 7 are
    // part of its distance.
    const here = record.line === null ? record.before.registers.pc : addressOfLine(record.line);
    const { word } = encodeAt(record.instruction, here);
    // A store's ALU worked out its address; a branch's took rs2 from rs1 to compare them.
    const { alu, comparison } = record;
    const made = alu ? alu.result : comparison ? comparison.a - comparison.b : 0;
    return file(u32(made), (word >>> 7) & 0x1f, 0);
  }
  const input = sent(record, after, rd);
  return input === null ? undefined : file(input, rd, 1);
}

/** The registers an executed RISC-V instruction wrote, or why there is none to show. */
export function rv32RegisterLink(record: ExecutionRecord, after: Snapshot | null): RegisterLink {
  const name = record.instruction.mnemonic.toUpperCase();
  if (!after) return { unavailable: NOT_KEPT };
  const file = fileOf(record, after);
  const writes = REGISTER_KEYS.flatMap((key, index) =>
    record.registersWritten.includes(key)
      ? [written(formatRegister(index), 32, record.before.registers[key], after.registers[key])]
      : []
  );
  if (writes.length > 0) return { writes, note: null, ...(file && { file }) };
  if (decode(record.instruction).rd !== ZERO) {
    return {
      unavailable: `${name} wrote none of the registers shown here. PC, which every instruction from the program loads, is shown with the control unit.`,
      ...(file && { file })
    };
  }
  return {
    unavailable: `${name} wrote to zero (x0), which has no flip-flops: it is wired to 0, so what is written to it is lost.`,
    ...(file && { file })
  };
}
