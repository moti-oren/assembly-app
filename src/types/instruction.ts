export type NumericUnaryOperands = { dst: number };
export type NumericBinaryOperands = { src: number } & NumericUnaryOperands;

export type Result<NumericOperands extends NumericUnaryOperands> = {
  operands: NumericOperands;
  result: number;
}

export default interface Instruction<NumericOperands extends NumericUnaryOperands> {
  name: string;
  opcode: number;
  description: string;
  operate (operands: NumericOperands): Result<NumericOperands>;
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
