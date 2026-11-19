import { CpuError } from '../shared/cpuError';
import type { ExecutionRecord as SharedRecord } from '../shared/executionRecord';
import type { Program } from '../shared/program';
import { snapshot } from '../shared/state';
import { resolveAddress, type AddressTrace } from './addressing';
import type { AluResult } from './alu';
import { modeOfInstruction, opcodeOf, type Instruction } from './instructions';
import { addressOfLine, instructionSize, lineAt } from './layout';
import { readByte, regionAt, writeByte, type Region } from './memory';
import { hex, type Operand } from './operands';
import { setFlag, STACK_PAGE, type CpuState, type FlagName, type RegisterName } from './state';

/** What the ALU did, kept so the flags it set can be explained. */
export interface AluTrace {
  operation: 'add' | 'subtract' | 'compare' | 'logic' | 'bit' | 'shift' | 'step';
  a: number;
  b: number;
  carryIn: boolean;
  decimal: boolean;
  result: AluResult;
}

export interface MemoryAccess {
  address: number;
  write: boolean;
  value: number;
  region: Region;
}

/** An executed 6502 instruction: what undo needs, and what explains it afterwards. */
export interface ExecutionRecord extends SharedRecord<Instruction, RegisterName> {
  alu: AluTrace | null;
  addressing: AddressTrace | null;
  /** The last memory access, a write for an instruction that reads a byte and writes it back. */
  access: MemoryAccess | null;
  cycles: number;
  /** For a branch: the flag it tested, and whether it branched. */
  branch: { flag: FlagName; taken: boolean } | null;
}

/** One instruction running: where it sits, and everything the undo record collects. */
export class Run {
  readonly record: ExecutionRecord;
  /** The address of the instruction after this one. */
  readonly next: number;

  constructor(
    readonly state: CpuState,
    readonly program: Program<Instruction>,
    readonly instruction: Instruction,
    /** Where this instruction sits; with a line, the program says; run directly, it is PC. */
    readonly here: number,
    line: number | null
  ) {
    this.next = (here + instructionSize(instruction)) & 0xffff;
    this.record = {
      instruction,
      line,
      before: snapshot(state),
      memoryWrites: [],
      portWrites: [],
      registersWritten: [],
      alu: null,
      addressing: null,
      access: null,
      cycles: opcodeOf(instruction)!.cycles,
      branch: null
    };
  }

  get(register: RegisterName): number {
    return this.state.registers[register];
  }

  set(register: Exclude<RegisterName, 'pc'>, value: number): void {
    this.state.registers[register] = value & 0xff;
    if (!this.record.registersWritten.includes(register))
      this.record.registersWritten.push(register);
  }

  readByte(address: number): number {
    return readByte(this.state, this.program, address);
  }

  /** The memory address the operand names, worked out by its addressing mode. */
  address(operand: Operand): number {
    const trace = resolveAddress(
      { index: (register) => this.get(register), readByte: (at) => this.readByte(at) },
      operand,
      modeOfInstruction(this.instruction)
    )!;
    this.record.addressing = trace;
    if (trace.pageCrossed && opcodeOf(this.instruction)!.pageCross) this.record.cycles++;
    return trace.address;
  }

  /** The operand's value: an immediate, A, or a byte from memory. */
  value(operand: Operand): number {
    if (operand.type === 'imm') return operand.value & 0xff;
    if (operand.type === 'acc') return this.get('a');
    const address = this.address(operand);
    const value = this.readByte(address);
    this.record.access = { address, write: false, value, region: regionAt(address, this.program) };
    return value;
  }

  store(address: number, value: number): void {
    const result = writeByte(this.state, this.program, address, value);
    this.record.memoryWrites.push(...result.memoryWrites);
    this.record.portWrites.push(...result.portWrites);
    this.record.access = {
      address,
      write: true,
      value: value & 0xff,
      region: regionAt(address, this.program)
    };
  }

  push(value: number): void {
    const sp = this.get('sp');
    const result = writeByte(this.state, this.program, STACK_PAGE | sp, value);
    this.record.memoryWrites.push(...result.memoryWrites);
    this.set('sp', sp - 1);
  }

  pull(): number {
    const sp = (this.get('sp') + 1) & 0xff;
    this.set('sp', sp);
    return this.readByte(STACK_PAGE | sp);
  }

  /** Records what the ALU did and sets the flags `flags` names from it. */
  alu(trace: Omit<AluTrace, 'result'>, result: AluResult, flags: string): AluResult {
    this.record.alu = { ...trace, result };
    if (flags.includes('N')) setFlag(this.state, 'N', result.negative);
    if (flags.includes('Z')) setFlag(this.state, 'Z', result.zero);
    if (flags.includes('C')) setFlag(this.state, 'C', result.carry);
    if (flags.includes('V')) setFlag(this.state, 'V', result.overflow);
    return result;
  }

  /** Jumps to an address, which must be where a program line starts, or the end of the program. */
  jump(address: number): void {
    if (lineAt(this.program, address) === null) {
      throw new CpuError(
        `No program line starts at $${hex(address, 4)}. The code runs from $0600, one line after another; a jump has to land on the first byte of a line.`
      );
    }
    this.state.registers.pc = address;
  }

  /** A branch to a line: a cycle more when taken, and one more when that is in another page. */
  branch(flag: FlagName, taken: boolean, target: number): void {
    this.record.branch = { flag, taken };
    if (!taken) return;
    const address = addressOfLine(this.program, target);
    this.record.cycles += (address & 0xff00) === (this.next & 0xff00) ? 1 : 2;
    this.jump(address);
  }
}
