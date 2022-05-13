export default interface Instruction {
  name: string;
  opcode: number;
  description: string;
}

export type UnaryOperands = {
  dst: number;
}

export type BinaryOperands = {
  src: number;
} & UnaryOperands;

export type UnaryResult = {
  operands: UnaryOperands;
  result: number;
}

export type BinaryResult = {
  operands: BinaryOperands;
  result: number;
}

export interface UnaryInstruction extends Instruction {
  operate: (operands: UnaryOperands) => UnaryResult;
}

export interface BinaryInstruction extends Instruction {
  operate: (operands: BinaryOperands) => BinaryResult;
}

export enum Names {
  mov = 'mov',
  inc = 'inc',
  dec = 'dec',
  add = 'add',
  sub = 'sub',
  mul = 'mul',
  imul = 'imul',
  div = 'div',
  idiv = 'idiv',
  not = 'not',
  and = 'and',
  or = 'or',
  xor = 'xor',
  shr = 'shr',
  shl = 'shl'
}
