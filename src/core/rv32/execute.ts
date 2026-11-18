import { CpuError } from '../shared/cpuError';
import { undo, type ExecutionRecord as SharedRecord } from '../shared/executionRecord';
import type { Program } from '../shared/program';
import { snapshot } from '../shared/state';
import { BRANCH_CONDITIONS, IMMEDIATE_OPERATIONS, OPERATIONS, type AluMnemonic } from './alu';
import { formatHex32, signExtend, u32 } from './bits';
import { formatInstruction, getSpec, isValid, type Instruction } from './instructions';
import { load, store, type AccessSize } from './memory';
import type { Operand } from './operands';
import { registerKey, type RegisterName } from './registers';
import {
  addressOfLine,
  INSTRUCTION_SIZE,
  lineAt,
  readRegister,
  writeRegister,
  type CpuState
} from './state';

/** What the ALU computed, kept so the result can be explained afterwards. */
export interface AluTrace {
  operation: AluMnemonic;
  a: number;
  b: number;
  result: number;
}

/** An executed RISC-V instruction: what undo needs, and what explains it afterwards. */
export interface ExecutionRecord extends SharedRecord<Instruction, RegisterName> {
  alu: AluTrace | null;
}

type Reg = Extract<Operand, { type: 'reg' }>;
type Mem = Extract<Operand, { type: 'mem' }>;

const LOAD_SIZES: Record<string, { size: AccessSize; signed: boolean }> = {
  lb: { size: 1, signed: true },
  lh: { size: 2, signed: true },
  lw: { size: 4, signed: false },
  lbu: { size: 1, signed: false },
  lhu: { size: 2, signed: false }
};

const STORE_SIZES: Record<string, AccessSize> = { sb: 1, sh: 2, sw: 4 };

/** One instruction running: its address, and everything the undo record collects. */
class Run {
  readonly record: ExecutionRecord;

  constructor(
    readonly state: CpuState,
    readonly program: Program<Instruction>,
    /** The address of this instruction; links and AUIPC count from it. */
    readonly here: number,
    instruction: Instruction,
    line: number | null
  ) {
    this.record = {
      instruction,
      line,
      before: snapshot(state),
      memoryWrites: [],
      portWrites: [],
      registersWritten: [],
      alu: null
    };
  }

  read(operand: Operand): number {
    return readRegister(this.state, (operand as Reg).index);
  }

  write(operand: Operand, value: number): void {
    const { index } = operand as Reg;
    writeRegister(this.state, index, value);
    const key = registerKey(index);
    if (index !== 0 && !this.record.registersWritten.includes(key)) {
      this.record.registersWritten.push(key);
    }
  }

  compute(operation: AluMnemonic, a: number, b: number): number {
    const result = OPERATIONS[operation](a, b);
    this.record.alu = { operation, a, b, result };
    return result;
  }

  address(operand: Operand): number {
    const { base, offset } = operand as Mem;
    return this.compute('add', readRegister(this.state, base), u32(offset));
  }

  /** Jumps to a code address, which must be the start of a program line or the end. */
  jump(address: number): void {
    const at = `0x${formatHex32(address)}`;
    if (address % INSTRUCTION_SIZE !== 0) {
      throw new CpuError(
        `Instruction address misaligned: every instruction is 4 bytes, so a jump target must be a multiple of 4, and ${at} is not.`
      );
    }
    if (lineAt(address, this.program.length) === null) {
      throw new CpuError(
        `No program line at ${at}: the code is 0x00000000 up to the end of the program.`
      );
    }
    this.state.registers.pc = address;
  }

  /** The address of the instruction after this one, which JAL and JALR keep as the link. */
  get next(): number {
    return u32(this.here + INSTRUCTION_SIZE);
  }
}

function runInstruction(run: Run, { mnemonic, operands }: Instruction): void {
  const [a, b, c] = operands;
  const { category } = getSpec(mnemonic);
  const immediateOperation = IMMEDIATE_OPERATIONS[mnemonic];
  if (immediateOperation) {
    const immediate = u32((c as { value: number }).value);
    run.write(a, run.compute(immediateOperation, run.read(b), immediate));
  } else if (mnemonic in OPERATIONS) {
    run.write(a, run.compute(mnemonic as AluMnemonic, run.read(b), run.read(c)));
  } else if (category === 'load') {
    const { size, signed } = LOAD_SIZES[mnemonic];
    const value = load(run.state, run.program, run.address(b), size);
    run.write(a, signed ? signExtend(value, size * 8) : value);
  } else if (category === 'store') {
    const result = store(
      run.state,
      run.program,
      run.address(b),
      STORE_SIZES[mnemonic],
      run.read(a)
    );
    run.record.memoryWrites.push(...result.memoryWrites);
    run.record.portWrites.push(...result.portWrites);
  } else if (category === 'branch') {
    const taken = BRANCH_CONDITIONS[mnemonic]!(run.read(a), run.read(b));
    if (taken) run.jump(addressOfLine((c as { target: number }).target));
  } else {
    runJumpOrUpper(run, mnemonic, a, b);
  }
}

function runJumpOrUpper(run: Run, mnemonic: string, a: Operand, b: Operand): void {
  switch (mnemonic) {
    case 'jal': {
      const target = addressOfLine((b as { target: number }).target);
      run.jump(target);
      run.write(a, run.next);
      return;
    }
    case 'jalr': {
      // The target is worked out before rd is written, so `jalr ra, 0(ra)` still works.
      const target = run.address(b) & ~1;
      run.jump(u32(target));
      run.write(a, run.next);
      return;
    }
    case 'lui':
      run.write(a, (b as { value: number }).value << 12);
      return;
    case 'auipc':
      run.write(a, run.compute('add', run.here, u32((b as { value: number }).value << 12)));
      return;
  }
}

/**
 * Runs one instruction against `state`. Either the whole instruction takes effect or, if it
 * raises a CpuError, the state is left exactly as it was.
 *
 * `line` is the program line it was fetched from: PC moves past it before it runs, as on a real
 * CPU, so a jump simply overwrites PC. An instruction run directly (line = null) runs as if it
 * sat at PC, and leaves PC alone unless it jumps.
 */
export function execute(
  state: CpuState,
  instruction: Instruction,
  line: number | null,
  program: Program<Instruction>
): ExecutionRecord {
  if (!isValid(instruction)) {
    throw new CpuError(
      `${formatInstruction(instruction)} isn't a valid RV32IM instruction. Remove the last word and pick again.`
    );
  }
  const here = line === null ? state.registers.pc : addressOfLine(line);
  const run = new Run(state, program, here, instruction, line);
  try {
    if (line !== null) state.registers.pc = run.next;
    runInstruction(run, instruction);
  } catch (error) {
    undo(state, run.record);
    throw error;
  }
  return run.record;
}
