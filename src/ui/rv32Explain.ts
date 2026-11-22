import { PORTS } from '@/core/shared/devices';
import { formatLabel, type Program } from '@/core/shared/program';
import type { AluMnemonic } from '@/core/rv32/alu';
import { formatHex32, s32 } from '@/core/rv32/bits';
import { decode } from '@/core/rv32/decode';
import { wordAt } from '@/core/rv32/encode';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { CATEGORY_LABELS, type Instruction, type Mnemonic } from '@/core/rv32/instructions';
import { formatRegister } from '@/core/rv32/operands';
import { REGISTER_KEYS } from '@/core/rv32/registers';
import { addressOfLine, DEVICE_BASE, lineAt, type CpuState } from '@/core/rv32/state';
import { describeBranch, list } from './explainText';

/** A 32-bit value as RISC-V tools write it. */
export function hex(value: number): string {
  return `0x${formatHex32(value)}`;
}

/** An address in the code, with the line it holds: `0x00000008 (L2)`. */
function codeAddress(address: number, lineCount: number): string {
  const line = lineAt(address, lineCount);
  return line === null ? hex(address) : `${hex(address)} (${formatLabel(line)})`;
}

export function describeFetch(line: number, program: Program<Instruction>): string {
  const word = line < program.length ? hex(wordAt(program, line)) : 'nothing';
  return `PC is ${hex(addressOfLine(line))}, where ${formatLabel(line)} starts. The CPU reads the 4-byte word there, ${word}, and PC moves on to ${hex(addressOfLine(line + 1))} before anything runs.`;
}

const SIZE_NAMES = { 1: 'byte', 2: 'half-word', 4: 'word' } as const;

export function describeDecode(instruction: Instruction): string {
  const decoded = decode(instruction);
  const { rd, rs1, rs2, immediate, memory, nextPc } = decoded;
  const fields = [
    rd !== null && `rd = ${formatRegister(rd)}`,
    rs1 !== null && `rs1 = ${formatRegister(rs1)}`,
    rs2 !== null && `rs2 = ${formatRegister(rs2)}`
  ].filter((field): field is string => typeof field === 'string');
  const reads = decoded.reads.map(formatRegister);
  const writes = decoded.writes.map(formatRegister);
  return [
    `${CATEGORY_LABELS[decoded.category]}, ${decoded.format}-type: ${decoded.description}.`,
    fields.length > 0 && `The register fields say ${list(fields)}.`,
    immediate !== null && `The immediate is ${hex(immediate)} (${s32(immediate)}).`,
    reads.length > 0 && `It will read ${list(reads)}.`,
    memory && `It will ${memory.access} a ${SIZE_NAMES[memory.size]}.`,
    writes.length > 0 && `It will write ${list(writes)}.`,
    nextPc === 'branch' && 'Whether it jumps depends on the comparison.',
    nextPc === 'jump' && 'It always jumps.'
  ]
    .filter(Boolean)
    .join(' ');
}

/** Registers whose value the instruction changed, by their ABI names. */
function changedRegisters(record: ExecutionRecord, state: CpuState): string[] {
  return REGISTER_KEYS.flatMap((key, index) =>
    record.before.registers[key] !== state.registers[key] ? [formatRegister(index)] : []
  );
}

const BRANCHES: Partial<Record<Mnemonic, { symbol: string; signed: boolean | null }>> = {
  beq: { symbol: '=', signed: null },
  bne: { symbol: '≠', signed: null },
  blt: { symbol: '<', signed: true },
  bge: { symbol: '≥', signed: true },
  bltu: { symbol: '<', signed: false },
  bgeu: { symbol: '≥', signed: false }
};

/** A compared value as the branch read it: unsigned for BLTU and BGEU, else signed. */
function compared(value: number, signed: boolean | null): string {
  return signed === false ? String(value >>> 0) : String(s32(value));
}

/** Why a branch was taken or not; null for any other instruction. */
function branchOutcome(record: ExecutionRecord): string | null {
  const branch = BRANCHES[record.instruction.mnemonic];
  const { comparison } = record;
  if (!branch || !comparison) return null;
  const [a, b] = (record.instruction.operands as { index: number }[]).map((operand) =>
    formatRegister(operand.index)
  );
  const how = branch.signed === null ? '' : branch.signed ? ', signed' : ', unsigned';
  const values = [
    `${a} is ${compared(comparison.a, branch.signed)}`,
    `${b} is ${compared(comparison.b, branch.signed)}`
  ];
  return describeBranch({
    name: record.instruction.mnemonic.toUpperCase(),
    verb: 'branches',
    when: `${a} ${branch.symbol} ${b}${how}`,
    // A register compared with itself is one value, not two.
    values: a === b ? values.slice(0, 1) : values,
    taken: comparison.taken
  });
}

export function describeExecute(
  record: ExecutionRecord,
  state: CpuState,
  program: Program<Instruction>
): string {
  const changed = [
    ...changedRegisters(record, state),
    ...(record.memoryWrites.length > 0 ? ['memory'] : []),
    ...(record.portWrites.length > 0 ? ['a device'] : [])
  ];
  const outcome = branchOutcome(record);
  // A branch changes nothing: its outcome is what there is to say.
  const nothing = outcome ? [] : ['It changed no register or memory.'];
  const effect = [...(changed.length ? [`It changed ${list(changed)}.`] : nothing), outcome]
    .filter(Boolean)
    .join(' ');
  const { pc } = state.registers;
  const at = codeAddress(pc, program.length);
  const moved = outcome ? `PC is now ${at}.` : `It jumped: PC is now ${at}.`;
  if (record.line === null) {
    const jumped = pc !== record.before.registers.pc;
    return `Ran directly (not from the program). ${effect}${jumped ? ` ${moved}` : ''}`;
  }
  const jumped = pc !== addressOfLine(record.line + 1);
  return `${effect} ${jumped ? moved : `PC is at ${at}, the next line.`}`;
}

const OPERATORS: Record<AluMnemonic, { symbol: string; note?: string }> = {
  add: { symbol: '+' },
  sub: { symbol: '−' },
  and: { symbol: 'AND' },
  or: { symbol: 'OR' },
  xor: { symbol: 'XOR' },
  sll: { symbol: '<<' },
  srl: { symbol: '>>', note: 'filling with 0' },
  sra: { symbol: '>>', note: 'keeping the sign' },
  slt: { symbol: '<', note: 'signed: 1 if true, else 0' },
  sltu: { symbol: '<', note: 'unsigned: 1 if true, else 0' },
  mul: { symbol: '×', note: 'low 32 bits' },
  mulh: { symbol: '×', note: 'signed, high 32 bits' },
  mulhsu: { symbol: '×', note: 'signed × unsigned, high 32 bits' },
  mulhu: { symbol: '×', note: 'unsigned, high 32 bits' },
  div: { symbol: '÷', note: 'signed' },
  divu: { symbol: '÷', note: 'unsigned' },
  rem: { symbol: 'mod', note: 'signed' },
  remu: { symbol: 'mod', note: 'unsigned' }
};

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

export function aluEquation(record: ExecutionRecord): AluEquation | null {
  const { alu, instruction } = record;
  if (!alu) return null;
  const { category, rd } = decode(instruction);
  const { symbol, note } = OPERATORS[alu.operation];
  let destination = rd !== null ? `into ${formatRegister(rd)}` : '';
  if (category === 'load' || category === 'store') destination = 'the address';
  if (instruction.mnemonic === 'jalr') destination = 'the jump target';
  return {
    left: hex(alu.a),
    operator: symbol,
    right: hex(alu.b),
    result: hex(alu.result),
    destination,
    note: note ?? null
  };
}

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
  record: ExecutionRecord,
  state: CpuState,
  program: Program<Instruction>
): ComparisonView | null {
  const branch = BRANCHES[record.instruction.mnemonic];
  const { comparison } = record;
  if (!branch || !comparison) return null;
  const [a, b] = record.instruction.operands as { index: number }[];
  const value = (v: number) => compared(v, branch.signed);
  const at = codeAddress(state.registers.pc, program.length);
  return {
    left: `${formatRegister(a.index)} = ${value(comparison.a)}`,
    operator: branch.symbol,
    right: `${formatRegister(b.index)} = ${value(comparison.b)}`,
    how:
      branch.signed === null
        ? 'bit for bit'
        : branch.signed
          ? 'as signed numbers'
          : 'as unsigned numbers',
    taken: comparison.taken,
    outcome: comparison.taken ? `true: jumped to ${at}` : `false: went on to ${at}`
  };
}

const DEVICE_NAMES: Record<number, string> = {
  [PORTS.leds]: 'the LEDs',
  [PORTS.switches]: 'the switches',
  [PORTS.digits]: 'the left digit',
  [PORTS.digits + 1]: 'the right digit',
  [PORTS.terminal]: 'the terminal'
};

/** The load or store the instruction made, in words, or null when it made none. */
export function describeAccess(record: ExecutionRecord): string | null {
  const { access } = record;
  if (!access) return null;
  const size = SIZE_NAMES[access.size];
  const value = `0x${access.value
    .toString(16)
    .toUpperCase()
    .padStart(access.size * 2, '0')}`;
  const where =
    access.region === 'device'
      ? `${hex(access.address)}, ${DEVICE_NAMES[access.address - DEVICE_BASE] ?? 'a device'}`
      : `${hex(access.address)}${access.region === 'code' ? ', in the code' : ''}`;
  return access.write
    ? `Stored the ${size} ${value} at ${where}`
    : `Loaded the ${size} ${value} from ${where}`;
}
