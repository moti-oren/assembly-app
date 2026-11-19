import { PORTS } from '@/core/shared/devices';
import { formatLabel, type Program } from '@/core/shared/program';
import type { AddressTrace } from '@/core/mos6502/addressing';
import { decode } from '@/core/mos6502/decode';
import { codeByte } from '@/core/mos6502/encode';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { CATEGORY_LABELS, opcodeOf, type Instruction } from '@/core/mos6502/instructions';
import { addressOfLine, lineAt } from '@/core/mos6502/layout';
import { hex, MODE_NAMES } from '@/core/mos6502/operands';
import { DEVICE_BASE, type CpuState, type RegisterName } from '@/core/mos6502/state';
import type { Messages } from './messages/en';

export const byteHex = (value: number) => `$${hex(value & 0xff, 2)}`;
export const wordHex = (value: number) => `$${hex(value & 0xffff, 4)}`;

const REGISTER_LABELS: Record<RegisterName, string> = {
  a: 'A',
  x: 'X',
  y: 'Y',
  sp: 'SP',
  pc: 'PC'
};

/** An address in the code with the line it starts, if one does: `$0602 (L1)`. */
function codeAddress(address: number, program: Program<Instruction>): string {
  const line = lineAt(program, address);
  return line === null ? wordHex(address) : `${wordHex(address)} (${formatLabel(line)})`;
}

export function describeFetch(m: Messages, line: number, program: Program<Instruction>): string {
  const e = m.mos6502Explain;
  const address = addressOfLine(program, line);
  if (line >= program.length) return e.pastEnd(wordHex(address));
  const decoded = decode(program[line]);
  return e.fetch(
    wordHex(address),
    formatLabel(line),
    byteHex(codeByte(program, address)),
    decoded.mnemonic.toUpperCase(),
    decoded.modeName,
    m.common.bytes(decoded.size),
    wordHex(address + decoded.size)
  );
}

export function describeDecode(m: Messages, instruction: Instruction): string {
  const e = m.mos6502Explain;
  const list = m.common.list;
  const decoded = decode(instruction);
  const names = (registers: RegisterName[]) => registers.map((name) => REGISTER_LABELS[name]);
  return m.common.sentences([
    e.kind(CATEGORY_LABELS[decoded.category], decoded.modeName, decoded.description),
    decoded.reads.length > 0 && e.reads(list(names(decoded.reads))),
    decoded.memory.read && e.readsMemory,
    decoded.memory.write && e.writesMemory,
    decoded.writes.length > 0 && e.writes(list(names(decoded.writes))),
    decoded.flagsWritten.length > 0 && e.sets(list(decoded.flagsWritten)),
    e.takes(decoded.cycles, opcodeOf(instruction)?.pageCross ?? false, decoded.nextPc === 'branch')
  ]);
}

/** The cycles an instruction took, and where the ones beyond its base count came from. */
export function cyclesBreakdown(m: Messages, record: ExecutionRecord): string {
  const e = m.mos6502Explain;
  const { cycles: base, pageCross } = opcodeOf(record.instruction)!;
  const page = pageCross && record.addressing?.pageCrossed ? 1 : 0;
  const branch = record.cycles - base - page;
  const extras = [
    page && e.extraPage,
    branch === 1 && e.extraBranch,
    branch === 2 && e.extraBranchPage
  ].filter((extra): extra is string => typeof extra === 'string');
  return extras.length
    ? e.cyclesPlus(record.cycles, base, m.common.list(extras))
    : e.cycles(record.cycles);
}

export function describeExecute(
  m: Messages,
  record: ExecutionRecord,
  state: CpuState,
  program: Program<Instruction>
): string {
  const e = m.mos6502Explain;
  const changed = (['a', 'x', 'y', 'sp'] as const)
    .filter((name) => record.before.registers[name] !== state.registers[name])
    .map((name) => REGISTER_LABELS[name]);
  if (record.before.flags !== state.flags) changed.push(e.flags);
  if (record.memoryWrites.length > 0) changed.push(e.memory);
  if (record.portWrites.length > 0) changed.push(e.device);
  const effect = changed.length ? e.changed(m.common.list(changed)) : e.changedNothing;
  const { pc } = state.registers;
  const at = codeAddress(pc, program);
  const cycles = `${cyclesBreakdown(m, record)}.`;
  if (record.line === null) {
    const jumped = pc !== record.before.registers.pc;
    return m.common.sentences([e.direct, effect, cycles, jumped && e.jumpedTo(at)]);
  }
  const jumped = pc !== addressOfLine(program, record.line + 1);
  return m.common.sentences([effect, cycles, jumped ? e.jumped(at) : e.nextLine(at)]);
}

/** How an address was formed, step by step, in the words of its addressing mode. */
export function addressSteps(m: Messages, trace: AddressTrace): string {
  const e = m.mos6502Explain;
  const { mode, base, index, pointer, address, pageCrossed } = trace;
  const indexed = index ? ` + ${index.register.toUpperCase()} (${byteHex(index.value)})` : '';
  const crossing = pageCrossed ? e.intoPage(byteHex(address >> 8)) : '';
  switch (mode) {
    case 'zp':
      return e.zeroPage(byteHex(base));
    case 'zpx':
    case 'zpy':
      return e.zeroPageIndexed(`${byteHex(base)}${indexed}`, byteHex(address));
    case 'abx':
    case 'aby':
      return `${wordHex(base)}${indexed} = ${wordHex(address)}${crossing}`;
    case 'izx':
      return e.indexedIndirect(
        `${byteHex(base)}${indexed}`,
        byteHex(pointer!.at),
        wordHex(address)
      );
    case 'izy':
      return e.indirectIndexed(
        byteHex(base),
        wordHex(pointer!.value),
        `${indexed} = ${wordHex(address)}${crossing}`
      );
    case 'ind': {
      const bug = (base & 0xff) === 0xff ? e.indirectBug(wordHex(base & 0xff00)) : '';
      return e.indirect(wordHex(base), wordHex(address), bug);
    }
    default:
      return wordHex(address);
  }
}

/** The devices by the port each one sits at. */
const DEVICES: Record<number, keyof Messages['mos6502Explain']['devices']> = {
  [PORTS.leds]: 'leds',
  [PORTS.switches]: 'switches',
  [PORTS.digits]: 'leftDigit',
  [PORTS.digits + 1]: 'rightDigit',
  [PORTS.terminal]: 'terminal'
};

/** The last memory access in words, or null when there was none. */
export function describeAccess(m: Messages, record: ExecutionRecord): string | null {
  const { access } = record;
  if (!access) return null;
  const e = m.mos6502Explain;
  const where =
    access.region === 'device'
      ? `${wordHex(access.address)}, ${e.devices[DEVICES[access.address - DEVICE_BASE] ?? 'other']}`
      : `${wordHex(access.address)}${access.region === 'code' ? `, ${e.inCode}` : ''}`;
  return access.write
    ? e.wrote(byteHex(access.value), where)
    : e.read(byteHex(access.value), where);
}

/** The addressing mode in words, for a record that formed an address. */
export function addressingMode(record: ExecutionRecord): string | null {
  return record.addressing ? MODE_NAMES[record.addressing.mode] : null;
}
