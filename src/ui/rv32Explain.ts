import { PORTS } from '@/core/shared/devices';
import { formatLabel, type Program } from '@/core/shared/program';
import type { AluMnemonic } from '@/core/rv32/alu';
import { formatHex32, s32 } from '@/core/rv32/bits';
import { decode } from '@/core/rv32/decode';
import { wordAt } from '@/core/rv32/encode';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction, Mnemonic } from '@/core/rv32/instructions';
import { formatRegister } from '@/core/rv32/operands';
import { REGISTER_KEYS } from '@/core/rv32/registers';
import { addressOfLine, DEVICE_BASE, lineAt, type CpuState } from '@/core/rv32/state';
import type { Messages } from './messages/en';

/** A 32-bit value as RISC-V tools write it. */
export function hex(value: number): string {
  return `0x${formatHex32(value)}`;
}

/** An address in the code, with the line it holds: `0x00000008 (L2)`. */
function codeAddress(address: number, lineCount: number): string {
  const line = lineAt(address, lineCount);
  return line === null ? hex(address) : `${hex(address)} (${formatLabel(line)})`;
}

export function describeFetch(m: Messages, line: number, program: Program<Instruction>): string {
  const e = m.rv32Explain;
  const word = line < program.length ? hex(wordAt(program, line)) : e.nothing;
  return e.fetch(hex(addressOfLine(line)), formatLabel(line), word, hex(addressOfLine(line + 1)));
}

export function describeDecode(m: Messages, instruction: Instruction): string {
  const e = m.rv32Explain;
  const list = m.common.list;
  const decoded = decode(instruction);
  const { rd, rs1, rs2, immediate, memory, nextPc } = decoded;
  const fields = [
    rd !== null && `rd = ${formatRegister(rd)}`,
    rs1 !== null && `rs1 = ${formatRegister(rs1)}`,
    rs2 !== null && `rs2 = ${formatRegister(rs2)}`
  ].filter((field): field is string => typeof field === 'string');
  const reads = decoded.reads.map(formatRegister);
  const writes = decoded.writes.map(formatRegister);
  return m.common.sentences([
    e.kind(
      m.rv32Text.category(decoded.category),
      decoded.format,
      m.rv32Text.description(instruction.mnemonic)
    ),
    fields.length > 0 && e.fields(list(fields)),
    immediate !== null && e.immediate(hex(immediate), s32(immediate)),
    reads.length > 0 && e.willRead(list(reads)),
    memory && e.willAccess(memory.access, e.sizes[memory.size]),
    writes.length > 0 && e.willWrite(list(writes)),
    nextPc === 'branch' && e.branch,
    nextPc === 'jump' && e.jump
  ]);
}

/** Registers whose value the instruction changed, by their ABI names. */
function changedRegisters(record: ExecutionRecord, state: CpuState): string[] {
  return REGISTER_KEYS.flatMap((key, index) =>
    record.before.registers[key] !== state.registers[key] ? [formatRegister(index)] : []
  );
}

export function describeExecute(
  m: Messages,
  record: ExecutionRecord,
  state: CpuState,
  program: Program<Instruction>
): string {
  const e = m.rv32Explain;
  const changed = [
    ...changedRegisters(record, state),
    ...(record.memoryWrites.length > 0 ? [e.memory] : []),
    ...(record.portWrites.length > 0 ? [e.device] : [])
  ];
  const effect = changed.length ? e.changed(m.common.list(changed)) : e.changedNothing;
  const { pc } = state.registers;
  const at = codeAddress(pc, program.length);
  if (record.line === null) {
    const jumped = pc !== record.before.registers.pc;
    return m.common.sentences([e.direct, effect, jumped && e.jumped(at)]);
  }
  const jumped = pc !== addressOfLine(record.line + 1);
  return m.common.sentences([effect, jumped ? e.jumped(at) : e.nextLine(at)]);
}

const OPERATORS: Record<AluMnemonic, string> = {
  add: '+',
  sub: '−',
  and: 'AND',
  or: 'OR',
  xor: 'XOR',
  sll: '<<',
  srl: '>>',
  sra: '>>',
  slt: '<',
  sltu: '<',
  mul: '×',
  mulh: '×',
  mulhsu: '×',
  mulhu: '×',
  div: '÷',
  divu: '÷',
  rem: 'mod',
  remu: 'mod'
};

/** The operations whose sum needs a word on how it was taken. */
type NotedMnemonic = keyof Messages['rv32Explain']['notes'];

function hasNote(mnemonic: AluMnemonic, m: Messages): mnemonic is NotedMnemonic {
  return mnemonic in m.rv32Explain.notes;
}

/** What the ALU worked out, written as a sum: the operands, the result and where it went. */
export interface AluEquation {
  left: string;
  operator: string;
  right: string;
  result: string;
  /** Where the result went: a register, or what the CPU used it as. */
  destination: string;
  note: string | null;
}

export function aluEquation(m: Messages, record: ExecutionRecord): AluEquation | null {
  const { alu, instruction } = record;
  if (!alu) return null;
  const e = m.rv32Explain;
  const { category, rd } = decode(instruction);
  let destination = rd !== null ? e.into(formatRegister(rd)) : '';
  if (category === 'load' || category === 'store') destination = e.theAddress;
  if (instruction.mnemonic === 'jalr') destination = e.jumpTarget;
  return {
    left: hex(alu.a),
    operator: OPERATORS[alu.operation],
    right: hex(alu.b),
    result: hex(alu.result),
    destination,
    note: hasNote(alu.operation, m) ? e.notes[alu.operation] : null
  };
}

const BRANCHES: Partial<Record<Mnemonic, { symbol: string; signed: boolean | null }>> = {
  beq: { symbol: '=', signed: null },
  bne: { symbol: '≠', signed: null },
  blt: { symbol: '<', signed: true },
  bge: { symbol: '≥', signed: true },
  bltu: { symbol: '<', signed: false },
  bgeu: { symbol: '≥', signed: false }
};

/** What a branch compared, and what came of it. */
export interface ComparisonView {
  left: string;
  operator: string;
  right: string;
  /** How the values were compared: as signed or unsigned numbers, or bit for bit. */
  how: string;
  taken: boolean;
  outcome: string;
}

export function describeComparison(
  m: Messages,
  record: ExecutionRecord,
  state: CpuState,
  program: Program<Instruction>
): ComparisonView | null {
  const branch = BRANCHES[record.instruction.mnemonic];
  const { comparison } = record;
  if (!branch || !comparison) return null;
  const [a, b] = record.instruction.operands as { index: number }[];
  const value = (v: number) => (branch.signed === false ? String(v >>> 0) : String(s32(v)));
  const at = codeAddress(state.registers.pc, program.length);
  return {
    left: `${formatRegister(a.index)} = ${value(comparison.a)}`,
    operator: branch.symbol,
    right: `${formatRegister(b.index)} = ${value(comparison.b)}`,
    how:
      branch.signed === null
        ? m.rv32Explain.bitForBit
        : branch.signed
          ? m.rv32Explain.asSigned
          : m.rv32Explain.asUnsigned,
    taken: comparison.taken,
    outcome: comparison.taken ? m.rv32Explain.taken(at) : m.rv32Explain.notTaken(at)
  };
}

/** The devices by the port each one sits at. */
const DEVICES: Record<number, keyof Messages['rv32Explain']['devices']> = {
  [PORTS.leds]: 'leds',
  [PORTS.switches]: 'switches',
  [PORTS.digits]: 'leftDigit',
  [PORTS.digits + 1]: 'rightDigit',
  [PORTS.terminal]: 'terminal'
};

/** The load or store the instruction made, in words, or null when it made none. */
export function describeAccess(m: Messages, record: ExecutionRecord): string | null {
  const { access } = record;
  if (!access) return null;
  const e = m.rv32Explain;
  const size = e.sizes[access.size];
  const value = `0x${access.value
    .toString(16)
    .toUpperCase()
    .padStart(access.size * 2, '0')}`;
  const where =
    access.region === 'device'
      ? `${hex(access.address)}, ${e.devices[DEVICES[access.address - DEVICE_BASE] ?? 'other']}`
      : `${hex(access.address)}${access.region === 'code' ? `, ${e.inCode}` : ''}`;
  return access.write ? e.stored(size, value, where) : e.loaded(size, value, where);
}
