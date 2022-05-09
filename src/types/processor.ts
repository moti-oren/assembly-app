import { Names as FlagsNames } from './flag';
import { Names as InstructionsNames } from './instruction';
import Register, { Names as RegisterNames } from './register';
import { Operands as IOperands } from './operation';

import registers from '../cpu-components/registers';
import flags from '../cpu-components/flags';
import instructions from '../cpu-components/instructions';

type UnaryOperation = (dst: Register) => Register;
type BinaryOperation = (dst: Register, src: Register | number) => Register;
type ShiftOperation = (amount: number) => Register;

export type Registers = {
  [I in keyof typeof RegisterNames]: typeof registers[I];
};

export type Flags = {
  [I in keyof typeof FlagsNames]: typeof flags[I];
};

export type Instructions = {
  [I in keyof typeof InstructionsNames]: typeof instructions[I];
};

type Operations = {
  [I in keyof typeof InstructionsNames]: UnaryOperation | BinaryOperation | ShiftOperation;
}

export type Operands<T extends 'dst' | 'src'> = {
  [P in T]: IOperands[P];
}

export default interface Processor extends Operations {
  registers: Registers;
  flags: Flags;
  instructions: Instructions;
}
