import type { ExecutionRecord } from './mos6502/executionContext';
import { REGISTER_NAMES, type CpuState } from './mos6502/state';
import { NOT_KEPT, nothingWritten, written, type RegisterLink } from './registerLink';

type Snapshot = Pick<CpuState, 'registers' | 'flags'>;

/** The registers an executed 6502 instruction wrote, or why there is none to show. */
export function mos6502RegisterLink(record: ExecutionRecord, after: Snapshot | null): RegisterLink {
  const name = record.instruction.mnemonic.toUpperCase();
  if (!after) return { unavailable: NOT_KEPT };
  const writes = REGISTER_NAMES.flatMap((register) =>
    register !== 'pc' && record.registersWritten.includes(register)
      ? [
          written(
            register.toUpperCase(),
            8,
            record.before.registers[register],
            after.registers[register]
          )
        ]
      : []
  );
  if (writes.length > 0) return { writes, note: null };
  const flags = record.before.flags !== after.flags ? 'P' : null;
  return { unavailable: nothingWritten(name, 'PC', flags) };
}
