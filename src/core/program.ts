import { PORTS } from './devices';
import { CpuError, VECTOR_SIZE, execute, type ExecutionRecord } from './execute';
import type { Instruction, Mnemonic } from './instructions';
import type { Operand } from './operands';
import type { CpuState } from './state';

/**
 * A program is a list of instructions. Instructions are not encoded into bytes, so IP holds
 * the index of the next line to run (L0, L1, ...), and jump targets are line indexes.
 * IP = program.length means the program has finished.
 */
export type Program = readonly Instruction[];

/** Stops runaway loops when running a whole program. */
const MAX_STEPS = 10_000;

/**
 * Stops a run whose records would hold too many memory writes. Every written byte is kept for
 * undo, and one REP with a full CX writes 65535 of them, so MAX_STEPS alone does not bound memory.
 */
export const MAX_RUN_WRITES = 1_000_000;

export function tooManyWrites(maxWrites = MAX_RUN_WRITES): CpuError {
  return new CpuError(
    `Stopped after ${maxWrites} memory writes, which usually means an endless loop. Use Step to see which jump keeps repeating.`
  );
}

function mapTargets(instruction: Instruction, map: (target: number) => number): Instruction {
  if (!instruction.operands.some((operand) => operand.type === 'label')) {
    return instruction;
  }
  return {
    ...instruction,
    operands: instruction.operands.map((operand): Operand =>
      operand.type === 'label' ? { type: 'label', target: map(operand.target) } : operand
    )
  };
}

/**
 * Inserts `instruction` before line `index`. Labels pointing at `index` or later keep pointing
 * at the same instructions (they shift down by one), so existing jumps stay correct. The new
 * instruction's own labels refer to the program as it was before the insert, and shift the same way.
 */
export function insertLine(
  program: Program,
  index: number,
  instruction: Instruction
): Instruction[] {
  const shift = (target: number) => (target >= index ? target + 1 : target);
  const shifted = program.map((line) => mapTargets(line, shift));
  return [...shifted.slice(0, index), mapTargets(instruction, shift), ...shifted.slice(index)];
}

/** Removes line `index`. Jumps that pointed at it now point at the line that took its place. */
export function removeLine(program: Program, index: number): Instruction[] {
  return program
    .filter((_, i) => i !== index)
    .map((line) => mapTargets(line, (target) => (target > index ? target - 1 : target)));
}

/** Where IP should point after inserting a line, so the same instruction still runs next. */
export function ipAfterInsert(ip: number, index: number): number {
  return ip > index ? ip + 1 : ip;
}

export function ipAfterRemove(ip: number, index: number): number {
  return ip > index ? ip - 1 : ip;
}

export function isFinished(state: CpuState, program: Program): boolean {
  return state.registers.ip >= program.length;
}

/** Runs the line IP points at. */
export function step(state: CpuState, program: Program): ExecutionRecord {
  const line = state.registers.ip;
  if (line >= program.length) {
    throw new CpuError('End of program: there is no line at IP');
  }
  return execute(state, program[line], line);
}

/**
 * Runs from IP to the end of the program. Returns the records of every executed line, even
 * when it stops early because of an error (`error`) or because it hit MAX_STEPS or
 * MAX_RUN_WRITES.
 */
export function runToEnd(
  state: CpuState,
  program: Program,
  maxSteps = MAX_STEPS,
  maxWrites = MAX_RUN_WRITES
): { records: ExecutionRecord[]; error: CpuError | null } {
  const records: ExecutionRecord[] = [];
  let writes = 0;
  while (!isFinished(state, program)) {
    if (records.length >= maxSteps) {
      return {
        records,
        error: new CpuError(
          `Stopped after ${maxSteps} steps, which usually means an endless loop. Use Step to see which jump keeps repeating.`
        )
      };
    }
    if (writes >= maxWrites) {
      return { records, error: tooManyWrites(maxWrites) };
    }
    try {
      const record = step(state, program);
      records.push(record);
      writes += record.memoryWrites.length;
    } catch (caught) {
      if (caught instanceof CpuError) {
        return { records, error: caught };
      }
      throw caught;
    }
  }
  return { records, error: null };
}

const reg = (name: Extract<Operand, { type: 'reg' }>['name']): Operand => ({ type: 'reg', name });
const imm = (value: number): Operand => ({ type: 'imm', value });
const label = (target: number): Operand => ({ type: 'label', target });
const line = (mnemonic: Mnemonic, ...operands: Operand[]): Instruction => ({ mnemonic, operands });
const port = imm;
const rep = (mnemonic: Mnemonic): Instruction => ({ prefix: 'rep', mnemonic, operands: [] });

export const EXAMPLE_PROGRAMS: { name: string; description: string; program: Program }[] = [
  {
    name: 'Sum 1..10',
    description: 'LOOP counts CX down; AX ends up as 55',
    program: [
      line('mov', reg('cx'), imm(10)),
      line('xor', reg('ax'), reg('ax')),
      line('add', reg('ax'), reg('cx')),
      line('loop', label(2))
    ]
  },
  {
    name: 'Max of AX, BX',
    description: 'CMP + a signed conditional jump; DX ends up as the larger value',
    program: [
      line('mov', reg('ax'), imm(-5)),
      line('mov', reg('bx'), imm(3)),
      line('mov', reg('dx'), reg('ax')),
      line('cmp', reg('ax'), reg('bx')),
      line('jge', label(6)),
      line('mov', reg('dx'), reg('bx')),
      line('nop')
    ]
  },
  {
    name: 'Call a subroutine',
    description: 'CALL pushes the return line, RET pops it back into IP',
    program: [
      line('mov', reg('ax'), imm(7)),
      line('call', label(3)),
      line('jmp', label(5)),
      line('shl', reg('ax'), imm(1)),
      line('ret'),
      line('nop')
    ]
  },
  {
    name: 'Swap with the stack',
    description: 'PUSH/POP in reverse order swaps AX and BX',
    program: [
      line('mov', reg('ax'), imm(0x1111)),
      line('mov', reg('bx'), imm(0x2222)),
      line('push', reg('ax')),
      line('push', reg('bx')),
      line('pop', reg('ax')),
      line('pop', reg('bx'))
    ]
  },
  {
    name: 'Fill and copy a string',
    description: 'REP STOSB fills 8 bytes at DS:0000, REP MOVSB copies them to DS:0010',
    program: [
      line('mov', reg('al'), imm(0x2a)),
      line('mov', reg('di'), imm(0)),
      line('mov', reg('cx'), imm(8)),
      rep('stosb'),
      line('mov', reg('si'), imm(0)),
      line('mov', reg('di'), imm(0x10)),
      line('mov', reg('cx'), imm(8)),
      rep('movsb')
    ]
  },
  {
    name: 'Running light',
    description: 'OUT sends a single 1 bit to the LEDs on port 10h, shifted left 8 times',
    program: [
      line('mov', reg('al'), imm(1)),
      line('mov', reg('cx'), imm(8)),
      line('out', port(PORTS.leds), reg('al')),
      line('shl', reg('al'), imm(1)),
      line('loop', label(2))
    ]
  },
  {
    name: 'Switches, digits and terminal',
    description: 'IN reads the switches; OUT copies them to the LEDs and a digit, then prints HI',
    program: [
      line('in', reg('al'), port(PORTS.switches)),
      line('out', port(PORTS.leds), reg('al')),
      line('out', port(PORTS.digits), reg('al')),
      line('mov', reg('al'), imm(0x48)),
      line('out', port(PORTS.terminal), reg('al')),
      line('mov', reg('al'), imm(0x49)),
      line('out', port(PORTS.terminal), reg('al'))
    ]
  },
  {
    name: 'Software interrupt',
    description: 'Installs a handler in vector 21h, then INT 21h prints AL on the terminal twice',
    program: [
      line('xor', reg('ax'), reg('ax')),
      line('mov', reg('ds'), reg('ax')),
      line(
        'mov',
        { type: 'mem', size: 16, base: null, displacement: 0x21 * VECTOR_SIZE },
        label(8)
      ),
      line('mov', reg('al'), imm(0x41)),
      line('int', imm(0x21)),
      line('mov', reg('al'), imm(0x42)),
      line('int', imm(0x21)),
      line('jmp', label(10)),
      line('out', port(PORTS.terminal), reg('al')),
      line('iret')
    ]
  }
];
