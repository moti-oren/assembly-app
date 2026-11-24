import type { ControlContext, ControlSolution } from './controlLink';
import { solve, tapValue, type AluRequest, type AluSolution, type Tap } from './logic/alu';
import type { Bit } from './logic/gates';
import { solvePc, type PcRequest } from './logic/programCounter';
import { barrelStages } from './logic/shifter';
import { OPERATIONS, type AluMnemonic } from './rv32/alu';
import { field, formatHex32, signExtend, u32 } from './rv32/bits';
import { disassemble } from './rv32/disassemble';
import { OPCODES } from './rv32/encode';
import { immediateOf } from './rv32/immediate';
import { MNEMONICS } from './rv32/instructions';
import type { AccessSize } from './rv32/memory';
import { INSTRUCTION_SIZE } from './rv32/state';
import { IMMEDIATE_LINES } from './rv32Control';

const WIDTH = 32;

/** The lines that put something on the ALU's output, in the order one is taken when two are 1. */
const RESULT_LINES = [
  'aluSum',
  'aluAnd',
  'aluOr',
  'aluXor',
  'aluShift',
  'setLess',
  'setLessUnsigned',
  'mulDiv'
];

/** The wire of the subtraction each line lets a branch read. */
const BRANCH_WIRES: Record<string, Tap> = {
  readZero: 'zero',
  readLess: 'less',
  readCarry: 'carryOut'
};

/** The lines that send something other than the ALU's result to rd. */
const SOURCE_LINES = { fromMemory: 'memory', link: 'link', upper: 'immediate' } as const;

/** Where the value written to rd comes from. */
export type WriteSource = 'alu' | (typeof SOURCE_LINES)[keyof typeof SOURCE_LINES];

/**
 * Something the lines ask for that a working control unit never does. It is reported, with the
 * lines behind it, and the datapath goes on with the first of them: nothing is guessed in silence.
 */
export interface PathConflict {
  kind:
    | 'immediate' // more than one layout for the immediate
    | 'result' // more than one circuit on the ALU's output
    | 'wire' // a branch reads more than one wire
    | 'source' // more than one value sent to rd
    | 'noResult' // the ALU's output is used, and no line puts anything on it
    | 'notRead' // rd takes what memory gave, and memory was not read
    | 'size' // funct3 asks for a size of access there is none of
    | 'illegal'; // the word is no instruction: a real CPU checks every bit and refuses it
  lines: string[];
}

/** A register the word names, with what it holds. */
export interface RegisterRead {
  index: number;
  value: number;
}

/** One input of the ALU, and which way its switch is turned. */
export interface AluInput {
  from: 'rs1' | 'pc' | 'rs2' | 'immediate';
  value: number;
}

/** A load or a store: where, how many bytes, and the bytes, or null when the access trapped. */
export interface MemoryStep {
  address: number;
  size: AccessSize;
  value: number | null;
}

/** What goes into rd when the clock rises. Register 0 is wired to 0 and keeps nothing. */
export interface RegisterWrite {
  index: number;
  value: number;
  from: WriteSource;
}

/** Everything a single-cycle datapath does with one word, told only by its control lines. */
export interface PathOutcome {
  rs1: RegisterRead;
  rs2: RegisterRead;
  immediate: number;
  a: AluInput;
  b: AluInput;
  /** The circuit whose output is the ALU's result, or null where there is none to show. */
  request: AluRequest | null;
  /** The ALU's result, or null when no line puts anything on its output. */
  result: number | null;
  /** What the branch's wire says, after its NOT gate when `invert` is 1. */
  taken: Bit;
  loaded: MemoryStep | null;
  stored: MemoryStep | null;
  write: RegisterWrite | null;
  pc: PcRequest;
  /** Why the CPU traps instead of finishing the instruction; then nothing is written. */
  trap: string | null;
  conflicts: PathConflict[];
}

type On = (line: string) => boolean;

/** The lines of `among` that are 1; more than one is a conflict, and the first is taken. */
function chosen(
  on: On,
  among: readonly string[],
  kind: PathConflict['kind'],
  conflicts: PathConflict[]
): string | null {
  const lines = among.filter(on);
  if (lines.length > 1) conflicts.push({ kind, lines });
  return lines[0] ?? null;
}

const adderRequest = (sub: boolean, a: number, b: number): AluRequest => ({
  kind: sub ? 'subtract' : 'add',
  width: WIDTH,
  a,
  b,
  carryIn: sub ? 1 : 0
});

function shiftRequest(on: On, value: number, count: number): AluRequest {
  return {
    kind: 'shift',
    width: WIDTH,
    value,
    direction: on('shiftRight') ? 'right' : 'left',
    fill: on('shiftRight') && on('shiftArithmetic') ? 'sign' : 'zero',
    carryIn: 0,
    stages: barrelStages(count & 31, WIDTH)
  };
}

/** The circuit the ALU's lines call for: the one whose output or wire the instruction keeps. */
function aluRequestOf(on: On, a: number, b: number): AluRequest {
  if (on('aluAnd')) return { kind: 'and', width: WIDTH, a, b };
  if (on('aluOr')) return { kind: 'or', width: WIDTH, a, b };
  if (on('aluXor')) return { kind: 'xor', width: WIDTH, a, b };
  if (on('aluShift')) return shiftRequest(on, a, b);
  return adderRequest(on('aluSub'), a, b);
}

const wire = (solution: AluSolution, tap: Tap): Bit => tapValue(solution, tap) ?? 0;

/** The M instruction funct3 picks; the multiplier and the divider are not drawn as gates. */
function multiplied(word: number, a: number, b: number): number {
  const mnemonic = MNEMONICS.find((name) => {
    const { funct3, funct7 } = OPCODES[name];
    return funct7 === 1 && funct3 === field(word, 14, 12);
  });
  if (!mnemonic) throw new Error('No M instruction has this funct3.');
  return OPERATIONS[mnemonic as AluMnemonic](a, b);
}

interface AluStep {
  request: AluRequest | null;
  result: number | null;
  taken: Bit;
}

/** The ALU: the adder always runs, and the lines choose what leaves and what a branch reads. */
function aluStep(word: number, on: On, a: number, b: number, conflicts: PathConflict[]): AluStep {
  const adder = solve(adderRequest(on('aluSub'), a, b));
  const read = chosen(on, Object.keys(BRANCH_WIRES), 'wire', conflicts);
  const compared = read ? wire(adder, BRANCH_WIRES[read]) : 0;
  const inverted: Bit = compared ? 0 : 1;
  const taken = on('invert') ? inverted : compared;
  const driver = chosen(on, RESULT_LINES, 'result', conflicts);
  const request = driver === 'mulDiv' ? null : aluRequestOf(on, a, b);
  switch (driver) {
    case null:
      return { request, result: null, taken };
    case 'mulDiv':
      return { request, result: multiplied(word, a, b), taken };
    case 'setLess':
      return { request, result: wire(adder, 'less'), taken };
    case 'setLessUnsigned':
      return { request, result: wire(adder, 'carryOut') ^ 1, taken };
    case 'aluSum':
      return { request, result: adder.result, taken };
    default:
      return { request, result: solve(aluRequestOf(on, a, b)).result, taken };
  }
}

/** The size of access funct3 asks for; a load also reads its top bit as "do not sign-extend". */
function accessSize(word: number, conflicts: PathConflict[]): AccessSize {
  const size = [1, 2, 4][field(word, 13, 12)] as AccessSize | undefined;
  if (size === undefined) conflicts.push({ kind: 'size', lines: [] });
  return size ?? 4;
}

/** The address a load or a store uses: the ALU's result, which some line has to put out. */
function addressOf(result: number | null, line: string, conflicts: PathConflict[]): number {
  if (result === null) conflicts.push({ kind: 'noResult', lines: [line] });
  return result ?? 0;
}

interface MemoryWork {
  loaded: MemoryStep | null;
  stored: MemoryStep | null;
  trap: string | null;
}

function memoryStep(
  word: number,
  on: On,
  result: number | null,
  rs2: number,
  { memory }: ControlContext,
  conflicts: PathConflict[]
): MemoryWork {
  const work: MemoryWork = { loaded: null, stored: null, trap: null };
  if (!on('memRead') && !on('memWrite')) return work;
  const size = accessSize(word, conflicts);
  if (on('memRead')) {
    const address = addressOf(result, 'memRead', conflicts);
    const read = memory.read(address, size);
    const fault = typeof read === 'number' ? null : read.fault;
    work.loaded = { address, size, value: typeof read === 'number' ? read : null };
    work.trap = fault;
  }
  if (on('memWrite')) {
    const address = addressOf(result, 'memWrite', conflicts);
    const fault = memory.storeFault(address, size);
    const value = u32(size === 4 ? rs2 : rs2 & (2 ** (8 * size) - 1));
    work.stored = { address, size, value: fault === null ? value : null };
    work.trap ??= fault;
  }
  return work;
}

/** What memory gave, widened to a register as funct3 says: bit 14 is "with zeros". */
function widened(word: number, { size, value }: MemoryStep): number {
  const read = value ?? 0;
  return size === 4 || field(word, 14, 14) === 1 ? read : signExtend(read, size * 8);
}

interface Values {
  result: number | null;
  loaded: MemoryStep | null;
  immediate: number;
  link: number;
}

/** What waits at rd's input, chosen by the lines that send something other than the result. */
function writeBack(
  word: number,
  on: On,
  { result, loaded, immediate, link }: Values,
  conflicts: PathConflict[]
): RegisterWrite | null {
  if (!on('regWrite')) return null;
  const index = field(word, 11, 7);
  const line = chosen(on, Object.keys(SOURCE_LINES), 'source', conflicts);
  const from: WriteSource = line ? SOURCE_LINES[line as keyof typeof SOURCE_LINES] : 'alu';
  if (from === 'alu' && result === null) conflicts.push({ kind: 'noResult', lines: ['regWrite'] });
  if (from === 'memory' && !loaded) conflicts.push({ kind: 'notRead', lines: ['fromMemory'] });
  const value = {
    alu: () => result ?? 0,
    memory: () => (loaded ? widened(word, loaded) : 0),
    link: () => link,
    immediate: () => immediate
  }[from]();
  return { index, value: u32(value), from };
}

interface PcInputs {
  here: number;
  fetched: Bit;
  immediate: number;
  result: number | null;
  taken: Bit;
}

/** What the lines and the ALU hand the program counter. */
function pcRequest(on: On, { here, fetched, immediate, result, taken }: PcInputs): PcRequest {
  const signal = (line: string): Bit => (on(line) ? 1 : 0);
  return {
    width: WIDTH,
    held: here,
    step: INSTRUCTION_SIZE,
    offset: immediate,
    // JALR's target is the ALU's sum with its lowest bit tied to 0.
    computed: u32((result ?? 0) & ~1),
    fetched,
    branch: signal('branch'),
    taken,
    jump: signal('jump'),
    jumpComputed: signal('jumpRegister')
  };
}

/** Why the address PC is sent to cannot hold an instruction, or null when it can. */
function jumpTrap(pc: PcRequest): string | null {
  const next = solvePc(pc).register.stored;
  return next % INSTRUCTION_SIZE === 0
    ? null
    : `Instruction address misaligned: every instruction is 4 bytes, so a jump target must be a multiple of 4, and 0x${formatHex32(next)} is not.`;
}

/**
 * Does an instruction word as a single-cycle datapath would, from its control lines alone: the
 * lines turn every switch, and nothing here knows which instruction the word is. With the lines
 * the decoders set, it does what the CPU did; with a line broken, what that CPU would do.
 */
export function runDatapath(
  word: number,
  { main, alu }: ControlSolution,
  context: ControlContext
): PathOutcome {
  const on: On = (line) => (main.signals[line] ?? alu.signals[line]) === 1;
  const conflicts: PathConflict[] = disassemble(word) ? [] : [{ kind: 'illegal', lines: [] }];
  const { registers, here, fetched } = context;
  const read = (high: number, low: number): RegisterRead => {
    const index = field(word, high, low);
    return { index, value: registers[index] };
  };
  const rs1 = read(19, 15);
  const rs2 = read(24, 20);
  const layout = chosen(on, Object.keys(IMMEDIATE_LINES), 'immediate', conflicts);
  const immediate = layout ? immediateOf(word, IMMEDIATE_LINES[layout]) : 0;
  const a: AluInput = on('aluSrcA') ? { from: 'pc', value: here } : { from: 'rs1', ...rs1 };
  const b: AluInput = on('aluSrcB')
    ? { from: 'immediate', value: immediate }
    : { from: 'rs2', ...rs2 };
  const { request, result, taken } = aluStep(word, on, a.value, b.value, conflicts);
  const memory = memoryStep(word, on, result, rs2.value, context, conflicts);
  const { loaded, stored } = memory;
  const link = u32(here + INSTRUCTION_SIZE);
  const write = writeBack(word, on, { result, loaded, immediate, link }, conflicts);
  if (on('jumpRegister') && result === null) {
    conflicts.push({ kind: 'noResult', lines: ['jumpRegister'] });
  }
  const pc = pcRequest(on, { here, fetched, immediate, result, taken });
  const trap = memory.trap ?? jumpTrap(pc);
  return {
    rs1,
    rs2,
    immediate,
    a: { from: a.from, value: a.value },
    b: { from: b.from, value: b.value },
    request,
    result,
    taken,
    loaded,
    stored: trap ? stored && { ...stored, value: null } : stored,
    write: trap ? null : write,
    pc,
    trap,
    conflicts
  };
}
