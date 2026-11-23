import { NOT_KEPT, nothingWritten, written, type RegisterLink } from './registerLink';
import { decode } from './rv32/decode';
import type { ExecutionRecord } from './rv32/execute';
import { formatRegister } from './rv32/operands';
import { REGISTER_KEYS, ZERO } from './rv32/registers';
import type { CpuState } from './rv32/state';

type Snapshot = Pick<CpuState, 'registers'>;

/** The registers an executed RISC-V instruction wrote, or why there is none to show. */
export function rv32RegisterLink(record: ExecutionRecord, after: Snapshot | null): RegisterLink {
  const name = record.instruction.mnemonic.toUpperCase();
  if (!after) return { unavailable: NOT_KEPT };
  const writes = REGISTER_KEYS.flatMap((key, index) =>
    record.registersWritten.includes(key)
      ? [written(formatRegister(index), 32, record.before.registers[key], after.registers[key])]
      : []
  );
  if (writes.length > 0) return { writes, note: null };
  return {
    unavailable:
      decode(record.instruction).rd === ZERO
        ? `${name} wrote to zero (x0), which has no flip-flops: it is wired to 0, so what is written to it is lost.`
        : nothingWritten(name, 'PC', null)
  };
}
