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

export const byteHex = (value: number) => `$${hex(value & 0xff, 2)}`;
export const wordHex = (value: number) => `$${hex(value & 0xffff, 4)}`;

const REGISTER_LABELS: Record<RegisterName, string> = {
  a: 'A',
  x: 'X',
  y: 'Y',
  sp: 'SP',
  pc: 'PC'
};

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** An address in the code with the line it starts, if one does: `$0602 (L1)`. */
function codeAddress(address: number, program: Program<Instruction>): string {
  const line = lineAt(program, address);
  return line === null ? wordHex(address) : `${wordHex(address)} (${formatLabel(line)})`;
}

export function describeFetch(line: number, program: Program<Instruction>): string {
  const address = addressOfLine(program, line);
  if (line >= program.length) return `PC is ${wordHex(address)}, past the last line.`;
  const decoded = decode(program[line]);
  return `PC is ${wordHex(address)}, where ${formatLabel(line)} starts. The CPU reads the opcode there, ${byteHex(codeByte(program, address))}: ${decoded.mnemonic.toUpperCase()} in the ${decoded.modeName} mode, ${decoded.size} byte${decoded.size === 1 ? '' : 's'} in all, so PC moves on to ${wordHex(address + decoded.size)}.`;
}

export function describeDecode(instruction: Instruction): string {
  const decoded = decode(instruction);
  const names = (registers: RegisterName[]) => registers.map((name) => REGISTER_LABELS[name]);
  return [
    `${CATEGORY_LABELS[decoded.category]}, ${decoded.modeName}: ${decoded.description}.`,
    decoded.reads.length > 0 && `It reads ${list(names(decoded.reads))}.`,
    decoded.memory.read && 'It will read a byte from memory.',
    decoded.memory.write && 'It will write a byte to memory.',
    decoded.writes.length > 0 && `It writes ${list(names(decoded.writes))}.`,
    decoded.flagsWritten.length > 0 && `It sets ${list(decoded.flagsWritten)}.`,
    `It takes ${decoded.cycles} cycles${opcodeOf(instruction)?.pageCross ? ', one more if indexing crosses a page' : ''}${decoded.nextPc === 'branch' ? ', more if it branches' : ''}.`
  ]
    .filter(Boolean)
    .join(' ');
}

/** The cycles an instruction took, and where the ones beyond its base count came from. */
export function cyclesBreakdown(record: ExecutionRecord): string {
  const { cycles: base, pageCross } = opcodeOf(record.instruction)!;
  const page = pageCross && record.addressing?.pageCrossed ? 1 : 0;
  const branch = record.cycles - base - page;
  const extras = [
    page && '1 for crossing a page',
    branch === 1 && '1 for taking the branch',
    branch === 2 && '2 for taking the branch into another page'
  ].filter((extra): extra is string => typeof extra === 'string');
  return extras.length
    ? `${record.cycles} cycles: ${base}, plus ${list(extras)}`
    : `${record.cycles} cycles`;
}

export function describeExecute(
  record: ExecutionRecord,
  state: CpuState,
  program: Program<Instruction>
): string {
  const changed = (['a', 'x', 'y', 'sp'] as const)
    .filter((name) => record.before.registers[name] !== state.registers[name])
    .map((name) => REGISTER_LABELS[name]);
  if (record.before.flags !== state.flags) changed.push('the flags');
  if (record.memoryWrites.length > 0) changed.push('memory');
  if (record.portWrites.length > 0) changed.push('a device');
  const effect = changed.length ? `It changed ${list(changed)}.` : 'It changed nothing.';
  const { pc } = state.registers;
  const cycles = `${cyclesBreakdown(record)}.`;
  if (record.line === null) {
    const jumped = pc !== record.before.registers.pc;
    return `Run directly, so nothing was fetched. ${effect} ${cycles}${jumped ? ` It jumped to ${codeAddress(pc, program)}.` : ''}`;
  }
  const jumped = pc !== addressOfLine(program, record.line + 1);
  return `${effect} ${cycles} ${jumped ? `It jumped: PC is now ${codeAddress(pc, program)}.` : `PC is at ${codeAddress(pc, program)}, the next line.`}`;
}

/** How an address was formed, step by step, in the words of its addressing mode. */
export function addressSteps(trace: AddressTrace): string {
  const { mode, base, index, pointer, address, pageCrossed } = trace;
  const indexed = index ? ` + ${index.register.toUpperCase()} (${byteHex(index.value)})` : '';
  const crossing = pageCrossed ? `, into page ${byteHex(address >> 8)}` : '';
  switch (mode) {
    case 'zp':
      return `${byteHex(base)}, in the zero page`;
    case 'zpx':
    case 'zpy':
      return `${byteHex(base)}${indexed} = ${byteHex(address)}, wrapping within the zero page`;
    case 'abx':
    case 'aby':
      return `${wordHex(base)}${indexed} = ${wordHex(address)}${crossing}`;
    case 'izx':
      return `${byteHex(base)}${indexed} = ${byteHex(pointer!.at)}; the pointer there holds ${wordHex(address)}`;
    case 'izy':
      return `The pointer at ${byteHex(base)} holds ${wordHex(pointer!.value)}${indexed} = ${wordHex(address)}${crossing}`;
    case 'ind': {
      const bug =
        (base & 0xff) === 0xff
          ? `, its high byte read from ${wordHex(base & 0xff00)}: the NMOS bug`
          : '';
      return `The address stored at ${wordHex(base)} is ${wordHex(address)}${bug}`;
    }
    default:
      return wordHex(address);
  }
}

const DEVICE_NAMES: Record<number, string> = {
  [PORTS.leds]: 'the LEDs',
  [PORTS.switches]: 'the switches',
  [PORTS.digits]: 'the left digit',
  [PORTS.digits + 1]: 'the right digit',
  [PORTS.terminal]: 'the terminal'
};

/** The last memory access in words, or null when there was none. */
export function describeAccess(record: ExecutionRecord): string | null {
  const { access } = record;
  if (!access) return null;
  const where =
    access.region === 'device'
      ? `${wordHex(access.address)}, ${DEVICE_NAMES[access.address - DEVICE_BASE] ?? 'a device'}`
      : `${wordHex(access.address)}${access.region === 'code' ? ', in the code' : ''}`;
  return access.write
    ? `Wrote ${byteHex(access.value)} to ${where}`
    : `Read ${byteHex(access.value)} from ${where}`;
}

/** The addressing mode in words, for a record that formed an address. */
export function addressingMode(record: ExecutionRecord): string | null {
  return record.addressing ? MODE_NAMES[record.addressing.mode] : null;
}
