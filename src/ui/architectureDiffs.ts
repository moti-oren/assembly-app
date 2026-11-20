import { formatHex } from '@/core/shared/numbers';
import { formatPhysical } from '@/core/x86/address';
import type { ExecutionRecord as X86Record } from '@/core/x86/execute';
import { FLAG_NAMES as X86_FLAGS, flagBit as x86FlagBit, type FlagName } from '@/core/x86/flags';
import { isByteRegister, wordOf, WORD_REGISTERS, type RegisterName } from '@/core/x86/registers';
import { readRegister, type CpuState as X86State } from '@/core/x86/state';
import { formatHex32 } from '@/core/rv32/bits';
import type { ExecutionRecord as Rv32Record } from '@/core/rv32/execute';
import { formatRegister } from '@/core/rv32/operands';
import { REGISTER_KEYS, registerKey } from '@/core/rv32/registers';
import { INSTRUCTION_SIZE, type CpuState as Rv32State } from '@/core/rv32/state';
import type { ExecutionRecord as Mos6502Record } from '@/core/mos6502/executionContext';
import { instructionSize } from '@/core/mos6502/layout';
import {
  FLAG_NAMES as MOS6502_FLAGS,
  flagBit as mos6502FlagBit,
  REGISTER_NAMES as MOS6502_REGISTERS,
  type CpuState as Mos6502State,
  type RegisterName as Mos6502Register,
  type FlagName as Mos6502Flag
} from '@/core/mos6502/state';
import { wasWritten } from './describe';
import {
  entry,
  flagEntries,
  memoryEntries,
  pointerChange,
  prioritize,
  valueChange,
  type DiffEntry,
  type ValueChange
} from './stepDiff';

const hex16 = (value: number) => formatHex(value, 16);
const hex8 = (value: number) => formatHex(value, 8);

/** Where IP goes when nothing jumps: the next line, or nowhere for a builder instruction. */
export function x86Pointer(record: X86Record, state: X86State): ValueChange | null {
  const { ip } = record.before.registers;
  const fallThrough = record.line === null ? ip : record.line + 1;
  return pointerChange(ip, state.registers.ip, fallThrough, hex16);
}

/** What the last instruction did to one register or half of one; IP says when it jumped. */
export function x86RegisterChange(
  record: X86Record,
  state: X86State,
  name: RegisterName
): ValueChange | null {
  if (name === 'ip') return x86Pointer(record, state);
  return valueChange(
    readRegister(record.before, name),
    readRegister(state, name),
    wasWritten(record, name),
    isByteRegister(name) ? hex8 : hex16
  );
}

function x86Registers(record: X86Record, state: X86State): DiffEntry[] {
  const written = record.registersWritten.filter((name) => name !== 'ip');
  const entries = written.flatMap((name) =>
    entry(name.toUpperCase(), 'register', x86RegisterChange(record, state, name))
  );
  // A register that changed without being listed as written still belongs in the diff.
  const covered = new Set(written.map(wordOf));
  for (const name of WORD_REGISTERS) {
    if (name === 'ip' || covered.has(name)) continue;
    const change = valueChange(record.before.registers[name], state.registers[name], false, hex16);
    entries.push(...entry(name.toUpperCase(), 'register', change));
  }
  return entries;
}

/** Everything the last 8086 instruction wrote or moved, most important first. */
export function x86StepDiff(record: X86Record, state: X86State): DiffEntry[] {
  return prioritize([
    ...x86Registers(record, state),
    ...memoryEntries(record.memoryWrites, 2, (address) => `[${formatPhysical(address)}h]`),
    ...flagEntries(X86_FLAGS, record.before.flags, state.flags, (name) =>
      x86FlagBit(name as FlagName)
    ),
    ...entry('IP', 'pointer', x86Pointer(record, state))
  ]);
}

/** Where PC goes when nothing jumps: the next instruction, or nowhere for a builder one. */
export function rv32Pointer(record: Rv32Record, state: Rv32State): ValueChange | null {
  const { pc } = record.before.registers;
  const fallThrough = record.line === null ? pc : (pc + INSTRUCTION_SIZE) >>> 0;
  return pointerChange(pc, state.registers.pc, fallThrough, formatHex32);
}

/** What the last instruction did to register `index` (x0 is never written). */
export function rv32RegisterChange(
  record: Rv32Record,
  state: Rv32State,
  index: number
): ValueChange | null {
  const key = registerKey(index);
  return valueChange(
    record.before.registers[key],
    state.registers[key],
    index !== 0 && record.registersWritten.includes(key),
    formatHex32
  );
}

/** Everything the last RISC-V instruction wrote or moved, most important first. */
export function rv32StepDiff(record: Rv32Record, state: Rv32State): DiffEntry[] {
  const registers = REGISTER_KEYS.flatMap((_, index) =>
    entry(formatRegister(index), 'register', rv32RegisterChange(record, state, index))
  );
  return prioritize([
    ...registers,
    ...memoryEntries(record.memoryWrites, 4, (address) => `[0x${formatHex32(address)}]`),
    ...entry('pc', 'pointer', rv32Pointer(record, state))
  ]);
}

/** Where PC goes when nothing jumps: past this instruction's bytes, or nowhere. */
export function mos6502Pointer(record: Mos6502Record, state: Mos6502State): ValueChange | null {
  const { pc } = record.before.registers;
  const size = record.line === null ? 0 : instructionSize(record.instruction);
  return pointerChange(pc, state.registers.pc, (pc + size) & 0xffff, hex16);
}

/** What the last instruction did to one register; PC says when it jumped. */
export function mos6502RegisterChange(
  record: Mos6502Record,
  state: Mos6502State,
  name: Mos6502Register
): ValueChange | null {
  if (name === 'pc') return mos6502Pointer(record, state);
  return valueChange(
    record.before.registers[name],
    state.registers[name],
    record.registersWritten.includes(name),
    hex8
  );
}

/** Everything the last 6502 instruction wrote or moved, most important first. */
export function mos6502StepDiff(record: Mos6502Record, state: Mos6502State): DiffEntry[] {
  const registers = MOS6502_REGISTERS.filter((name) => name !== 'pc').flatMap((name) =>
    entry(name.toUpperCase(), 'register', mos6502RegisterChange(record, state, name))
  );
  return prioritize([
    ...registers,
    ...memoryEntries(record.memoryWrites, 1, (address) => `[$${hex16(address)}]`),
    ...flagEntries(MOS6502_FLAGS, record.before.flags, state.flags, (name) =>
      mos6502FlagBit(name as Mos6502Flag)
    ),
    ...entry('PC', 'pointer', mos6502Pointer(record, state))
  ]);
}
