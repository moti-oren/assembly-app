import { formatHex } from '@/core/shared/numbers';
import { formatPhysical } from '@/core/x86/address';
import type { ExecutionRecord as X86Record } from '@/core/x86/execute';
import { FLAG_NAMES as X86_FLAGS, flagBit as x86FlagBit, type FlagName } from '@/core/x86/flags';
import { isByteRegister, wordOf, WORD_REGISTERS, type RegisterName } from '@/core/x86/registers';
import { readRegister } from '@/core/x86/state';
import { formatHex32 } from '@/core/rv32/bits';
import type { ExecutionRecord as Rv32Record } from '@/core/rv32/execute';
import { formatRegister } from '@/core/rv32/operands';
import { REGISTER_KEYS, registerKey } from '@/core/rv32/registers';
import { DEVICE_BASE as RV32_DEVICES, INSTRUCTION_SIZE } from '@/core/rv32/state';
import type { ExecutionRecord as Mos6502Record } from '@/core/mos6502/executionContext';
import { instructionSize } from '@/core/mos6502/layout';
import {
  DEVICE_BASE as MOS6502_DEVICES,
  FLAG_NAMES as MOS6502_FLAGS,
  flagBit as mos6502FlagBit,
  REGISTER_NAMES as MOS6502_REGISTERS,
  type RegisterName as Mos6502Register,
  type FlagName as Mos6502Flag
} from '@/core/mos6502/state';
import { wasWritten } from './describe';
import {
  entry,
  flagEntries,
  memoryEntries,
  pointerChange,
  portEntries,
  prioritize,
  valueChange,
  type DiffEntry,
  type StepDiff,
  type ValueChange
} from './stepDiff';

/*
 * Each function compares the CPU before a step (in its record) with the CPU as the step left it
 * (`after`, a snapshot taken then), not with the live CPU: an edit to the program moves the
 * instruction pointer afterwards, and that is not something the step did.
 */
type X86After = X86Record['before'];
type Rv32After = Rv32Record['before'];
type Mos6502After = Mos6502Record['before'];

const hex16 = (value: number) => formatHex(value, 16);
const hex8 = (value: number) => formatHex(value, 8);

/** Where IP goes when nothing jumps: the next line, or nowhere for a builder instruction. */
export function x86Pointer(record: X86Record, after: X86After): ValueChange | null {
  const { ip } = record.before.registers;
  const fallThrough = record.line === null ? ip : record.line + 1;
  return pointerChange(ip, after.registers.ip, fallThrough, hex16);
}

/** What the last instruction did to one register or half of one; IP says when it jumped. */
export function x86RegisterChange(
  record: X86Record,
  after: X86After,
  name: RegisterName
): ValueChange | null {
  if (name === 'ip') return x86Pointer(record, after);
  return valueChange(
    readRegister(record.before, name),
    readRegister(after, name),
    wasWritten(record, name),
    isByteRegister(name) ? hex8 : hex16
  );
}

function x86Registers(record: X86Record, after: X86After): DiffEntry[] {
  const written = record.registersWritten.filter((name) => name !== 'ip');
  const entries = written.flatMap((name) =>
    entry(name.toUpperCase(), 'register', x86RegisterChange(record, after, name))
  );
  // A register that changed without being listed as written still belongs in the diff.
  const covered = new Set(written.map(wordOf));
  for (const name of WORD_REGISTERS) {
    if (name === 'ip' || covered.has(name)) continue;
    const change = valueChange(record.before.registers[name], after.registers[name], false, hex16);
    entries.push(...entry(name.toUpperCase(), 'register', change));
  }
  return entries;
}

/** Everything the last 8086 instruction wrote or moved, most important first. */
export function x86StepDiff(record: X86Record, after: X86After): StepDiff {
  const memory = memoryEntries(
    record.memoryWrites,
    2,
    (address) => `[${formatPhysical(address)}h]`
  );
  const entries = prioritize([
    ...x86Registers(record, after),
    ...memory.entries,
    ...portEntries(record.portWrites, (port) => `port ${hex16(port)}h`),
    ...flagEntries(X86_FLAGS, record.before.flags, after.flags, (name) =>
      x86FlagBit(name as FlagName)
    ),
    ...entry('IP', 'pointer', x86Pointer(record, after))
  ]);
  return { entries, omitted: memory.omitted };
}

/** Where PC goes when nothing jumps: the next instruction, or nowhere for a builder one. */
export function rv32Pointer(record: Rv32Record, after: Rv32After): ValueChange | null {
  const { pc } = record.before.registers;
  const fallThrough = record.line === null ? pc : (pc + INSTRUCTION_SIZE) >>> 0;
  return pointerChange(pc, after.registers.pc, fallThrough, formatHex32);
}

/** What the last instruction did to register `index` (x0 is never written). */
export function rv32RegisterChange(
  record: Rv32Record,
  after: Rv32After,
  index: number
): ValueChange | null {
  const key = registerKey(index);
  return valueChange(
    record.before.registers[key],
    after.registers[key],
    index !== 0 && record.registersWritten.includes(key),
    formatHex32
  );
}

/** Everything the last RISC-V instruction wrote or moved, most important first. */
export function rv32StepDiff(record: Rv32Record, after: Rv32After): StepDiff {
  const registers = REGISTER_KEYS.flatMap((_, index) =>
    entry(formatRegister(index), 'register', rv32RegisterChange(record, after, index))
  );
  const address = (at: number) => `[0x${formatHex32(at)}]`;
  const memory = memoryEntries(record.memoryWrites, 4, address);
  const entries = prioritize([
    ...registers,
    ...memory.entries,
    ...portEntries(record.portWrites, (port) => address(RV32_DEVICES + port)),
    ...entry('pc', 'pointer', rv32Pointer(record, after))
  ]);
  return { entries, omitted: memory.omitted };
}

/** Where PC goes when nothing jumps: past this instruction's bytes, or nowhere. */
export function mos6502Pointer(record: Mos6502Record, after: Mos6502After): ValueChange | null {
  const { pc } = record.before.registers;
  const size = record.line === null ? 0 : instructionSize(record.instruction);
  return pointerChange(pc, after.registers.pc, (pc + size) & 0xffff, hex16);
}

/** What the last instruction did to one register; PC says when it jumped. */
export function mos6502RegisterChange(
  record: Mos6502Record,
  after: Mos6502After,
  name: Mos6502Register
): ValueChange | null {
  if (name === 'pc') return mos6502Pointer(record, after);
  return valueChange(
    record.before.registers[name],
    after.registers[name],
    record.registersWritten.includes(name),
    hex8
  );
}

/** Everything the last 6502 instruction wrote or moved, most important first. */
export function mos6502StepDiff(record: Mos6502Record, after: Mos6502After): StepDiff {
  const registers = MOS6502_REGISTERS.filter((name) => name !== 'pc').flatMap((name) =>
    entry(name.toUpperCase(), 'register', mos6502RegisterChange(record, after, name))
  );
  const address = (at: number) => `[$${hex16(at)}]`;
  const memory = memoryEntries(record.memoryWrites, 1, address);
  const entries = prioritize([
    ...registers,
    ...memory.entries,
    ...portEntries(record.portWrites, (port) => address(MOS6502_DEVICES + port)),
    ...flagEntries(MOS6502_FLAGS, record.before.flags, after.flags, (name) =>
      mos6502FlagBit(name as Mos6502Flag)
    ),
    ...entry('PC', 'pointer', mos6502Pointer(record, after))
  ]);
  return { entries, omitted: memory.omitted };
}
