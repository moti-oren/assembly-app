import { resultTaps, tap, type AluCircuit, type AluLink, type FlagTap } from './aluLink';
import type { AluRequest } from './logic/alu';
import type { Bit } from './logic/gates';
import type { ShiftDirection, ShiftFill } from './logic/shifter';
import type { AluTrace, ExecutionRecord } from './mos6502/executionContext';
import type { Mnemonic } from './mos6502/instructions';

const WIDTH = 8;

const RESULT_TAPS = resultTaps('Z', 'N');

const LOGIC: Partial<Record<Mnemonic, 'and' | 'or' | 'xor'>> = {
  and: 'and',
  ora: 'or',
  eor: 'xor'
};

const SHIFTS: Partial<Record<Mnemonic, { direction: ShiftDirection; fill: ShiftFill }>> = {
  asl: { direction: 'left', fill: 'zero' },
  lsr: { direction: 'right', fill: 'zero' },
  rol: { direction: 'left', fill: 'carry' },
  ror: { direction: 'right', fill: 'carry' }
};

const circuit = (
  request: AluRequest,
  taps: FlagTap[],
  note: string | null = null,
  resultKept = true
): AluCircuit => ({ request, taps, cleared: [], resultKept, note });

/**
 * The 6502 has one adder and no borrow: SBC adds the inverse and takes C as the carry in, so C
 * after a subtraction is the adder's carry out as it stands, 1 meaning "no borrow".
 */
function arithmetic(alu: AluTrace): AluCircuit {
  const { a, b } = alu;
  const carryIn: Bit = alu.carryIn ? 1 : 0;
  const carryAndOverflow = [tap('C', 'carryOut'), tap('V', 'overflow'), ...RESULT_TAPS];
  if (alu.operation === 'add') {
    return circuit({ kind: 'add', width: WIDTH, a, b, carryIn }, carryAndOverflow);
  }
  return circuit(
    { kind: 'subtract', width: WIDTH, a, b, carryIn },
    carryAndOverflow,
    'The carry in is C itself: clear it before SBC and one more is taken off.'
  );
}

function step(alu: AluTrace, mnemonic: Mnemonic): AluCircuit {
  const down = mnemonic.startsWith('de');
  return circuit(
    { kind: down ? 'subtract' : 'add', width: WIDTH, a: alu.a, b: 1, carryIn: down ? 1 : 0 },
    RESULT_TAPS,
    `${mnemonic.toUpperCase()} leaves C alone: the carry out is not connected to it.`
  );
}

function computed(alu: AluTrace, mnemonic: Mnemonic): AluLink {
  const { a, b } = alu;
  switch (alu.operation) {
    case 'add':
    case 'subtract':
      return arithmetic(alu);
    case 'compare':
      return circuit(
        { kind: 'subtract', width: WIDTH, a, b, carryIn: 1 },
        [tap('C', 'carryOut'), ...RESULT_TAPS],
        null,
        false
      );
    case 'logic':
      return circuit({ kind: LOGIC[mnemonic]!, width: WIDTH, a, b }, RESULT_TAPS);
    case 'bit':
      return circuit(
        { kind: 'and', width: WIDTH, a, b },
        [tap('Z', 'zero')],
        'N and V are copied from bits 7 and 6 of the byte; the ALU only works out Z.',
        false
      );
    case 'shift':
      return circuit(
        {
          kind: 'shift',
          width: WIDTH,
          value: a,
          ...SHIFTS[mnemonic]!,
          carryIn: alu.carryIn ? 1 : 0,
          stages: [{ distance: 1, on: 1 }]
        },
        [tap('C', 'carry'), ...RESULT_TAPS]
      );
    case 'step':
      return step(alu, mnemonic);
  }
}

/** The circuit behind an executed 6502 instruction, or why there is none to show. */
export function mos6502AluLink(record: ExecutionRecord): AluLink {
  const { alu, instruction } = record;
  const name = instruction.mnemonic.toUpperCase();
  if (!alu) return { unavailable: `${name} worked nothing out in the ALU.` };
  if (alu.decimal) {
    return {
      unavailable: `In decimal mode ${name} corrects each digit after the sum; that circuit is not shown yet.`
    };
  }
  return computed(alu, instruction.mnemonic);
}
