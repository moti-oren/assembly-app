import {
  NOT_KEPT,
  nothingWritten,
  written,
  type RegisterLink,
  type RegisterWrite
} from './registerLink';
import { decode } from './x86/decode';
import type { ExecutionRecord } from './x86/execute';
import {
  BYTE_REGISTER_LOCATION,
  isByteRegister,
  wordOf,
  WORD_REGISTERS,
  type RegisterName,
  type WordRegister
} from './x86/registers';
import type { CpuSnapshot } from './x86/state';

/** The flip-flops of a word register that a name reaches: all 16, or the 8 of one half. */
function reach(name: RegisterName): number {
  if (!isByteRegister(name)) return 0xffff;
  return BYTE_REGISTER_LOCATION[name].high ? 0xff00 : 0x00ff;
}

/**
 * AL and AH are not registers of their own: they are halves of AX's sixteen flip-flops, so a
 * write to one of them is a write to AX with only eight of its write lines on.
 */
function writesOf(record: ExecutionRecord, after: CpuSnapshot): RegisterWrite[] {
  const names = record.registersWritten.filter((name) => name !== 'ip');
  const words = WORD_REGISTERS.filter((word) => names.some((name) => wordOf(name) === word));
  return words.map((word: WordRegister) => {
    const parts = names.filter((name) => wordOf(name) === word);
    const enabled = parts.reduce((mask, name) => mask | reach(name), 0);
    return written(
      word.toUpperCase(),
      16,
      record.before.registers[word],
      after.registers[word],
      enabled,
      enabled === 0xffff ? null : parts.map((name) => name.toUpperCase()).join(' and ')
    );
  });
}

/** The registers an executed 8086 instruction wrote, or why there is none to show. */
export function x86RegisterLink(record: ExecutionRecord, after: CpuSnapshot | null): RegisterLink {
  const name = record.instruction.mnemonic.toUpperCase();
  if (!after) return { unavailable: NOT_KEPT };
  const writes = writesOf(record, after);
  if (writes.length === 0) {
    // Written, as a register is, whether or not the value changed.
    const flags = decode(record.instruction).writesFlags ? 'FLAGS' : null;
    return { unavailable: nothingWritten(name, 'IP', flags) };
  }
  const half = writes.find((write) => write.part !== null);
  return {
    writes,
    note: half
      ? `${half.part} is not a register of its own: it is half of ${half.register}, whose other flip-flops are not written.`
      : null
  };
}
