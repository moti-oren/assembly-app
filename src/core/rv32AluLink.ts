import { tap, type AluCircuit, type AluLink, type FlagTap } from './aluLink';
import type { AluRequest } from './logic/alu';
import { barrelStages, type ShiftDirection, type ShiftFill } from './logic/shifter';
import type { AluMnemonic } from './rv32/alu';
import type { AluTrace, Comparison, ExecutionRecord } from './rv32/execute';
import type { Mnemonic } from './rv32/instructions';

const WIDTH = 32;

/** What a branch is called here: RISC-V has no flag to name. */
export const BRANCH_TAKEN = 'taken';
/** What SLT and SLTU write: the 0 or 1 that goes into rd. */
export const SET_RESULT = 'rd';

const subtraction = (a: number, b: number): AluRequest => ({
  kind: 'subtract',
  width: WIDTH,
  a,
  b,
  carryIn: 1
});

/** Each branch subtracts its two registers and reads one wire of the result. */
const BRANCHES: Partial<Record<Mnemonic, FlagTap>> = {
  beq: tap(BRANCH_TAKEN, 'zero'),
  bne: tap(BRANCH_TAKEN, 'zero', true),
  blt: tap(BRANCH_TAKEN, 'less'),
  bge: tap(BRANCH_TAKEN, 'less', true),
  bltu: tap(BRANCH_TAKEN, 'carryOut', true),
  bgeu: tap(BRANCH_TAKEN, 'carryOut')
};

const SHIFTS: Partial<Record<AluMnemonic, { direction: ShiftDirection; fill: ShiftFill }>> = {
  sll: { direction: 'left', fill: 'zero' },
  srl: { direction: 'right', fill: 'zero' },
  sra: { direction: 'right', fill: 'sign' }
};

const NO_FLAGS = 'RISC-V keeps no flags: the result is all that leaves the ALU.';

const circuit = (request: AluRequest, note: string | null = NO_FLAGS): AluCircuit => ({
  request,
  taps: [],
  cleared: [],
  resultKept: true,
  note
});

function branch(comparison: Comparison, wire: FlagTap): AluCircuit {
  return {
    request: subtraction(comparison.a, comparison.b),
    taps: [wire],
    cleared: [],
    resultKept: false,
    note: 'A branch subtracts its two registers and keeps one wire: whether to jump.'
  };
}

function setLess(alu: AluTrace, wire: FlagTap): AluCircuit {
  return {
    request: subtraction(alu.a, alu.b),
    taps: [wire],
    cleared: [],
    resultKept: false,
    note: 'The difference is thrown away: rd gets the one wire that says "less than".'
  };
}

function computed(alu: AluTrace): AluLink {
  const { operation, a, b } = alu;
  const shape = SHIFTS[operation];
  if (shape) {
    return circuit(
      {
        kind: 'shift',
        width: WIDTH,
        value: a,
        ...shape,
        carryIn: 0,
        stages: barrelStages(b & 31, WIDTH)
      },
      'A barrel shifter: five rows that move 1, 2, 4, 8 and 16 places, each switched by one bit of the count.'
    );
  }
  switch (operation) {
    case 'add':
      return circuit({ kind: 'add', width: WIDTH, a, b, carryIn: 0 });
    case 'sub':
      return circuit(subtraction(a, b));
    case 'and':
    case 'or':
    case 'xor':
      return circuit({ kind: operation, width: WIDTH, a, b });
    case 'slt':
      return setLess(alu, tap(SET_RESULT, 'less'));
    case 'sltu':
      return setLess(alu, tap(SET_RESULT, 'carryOut', true));
    default:
      return {
        unavailable: `${operation.toUpperCase()} takes many additions and shifts; that circuit is not shown yet.`
      };
  }
}

/** The circuit behind an executed RISC-V instruction, or why there is none to show. */
export function rv32AluLink(record: ExecutionRecord): AluLink {
  const { alu, comparison, instruction } = record;
  const wire = BRANCHES[instruction.mnemonic];
  if (comparison && wire) return branch(comparison, wire);
  if (alu) return computed(alu);
  return { unavailable: `${instruction.mnemonic.toUpperCase()} worked nothing out in the ALU.` };
}
