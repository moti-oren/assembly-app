import { Register } from './register';

export type SrcOperand = Register | number;
export type DstOperand = Register;

export type UnaryOperation = (dst: number) => number;
export type BinaryOperation = (dst: number, src: number) => number;

export interface Operation {
  src?: number;
  dst: number;
  result: number;
}

export interface Operands {
  dstOperand: DstOperand;
  srcOperand?: SrcOperand;
}

export interface Instruction {
  description: string;
  opecode: string;
  execute: UnaryOperation | BinaryOperation;
  test (operands: Operands): Operation;
  perform (operands: Operands): Operation; // TODO
}
