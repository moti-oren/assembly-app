import { Register } from './register';

export interface Instruction {
  perform(operands: Operands): Operation;
}

export interface Operands {
  dstOperand: Register;
  srcOperand?: Register | number;
}

export interface Operation {
  src?: number;
  dst: number;
  result: number;
}

export interface UnaryOperation {
  (dst: number): number;
}

export interface BinaryOperation {
  (dst: number, src: number): number;
}
