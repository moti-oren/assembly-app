import { Register } from './register';
import { Flag } from './flag';
import { Instruction } from './instruction';

export interface Registers {
  [index: string]: Register;
}

export interface Flags {
  [index: string]: Flag;
}

export interface Instructions {
  [index: string]: Instruction;
}

export default interface Processor {
  registers: Registers;
  flags: Flags;
  instructions: Instructions;
}
