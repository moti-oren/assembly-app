export type Size = 8 | 16 | 32;
export type RegisterSize = 16;
export type SubRegisterSize = 8;

type UnaryOperation = (reg: Register) => Register;
type BinaryOperation = (reg: Register, src: Register | number) => Register;
type ShiftOperation = (amount: number) => Register;

interface OperationsMethods {
  mov: BinaryOperation;
  inc: UnaryOperation;
  dec: UnaryOperation;
  add: BinaryOperation;
  sub: BinaryOperation;
  mul: UnaryOperation;
  imul: UnaryOperation;
  div: UnaryOperation;
  idiv: UnaryOperation;
  not: UnaryOperation;
  and: BinaryOperation;
  or: BinaryOperation;
  xor: BinaryOperation;
  shr: ShiftOperation;
  shl: ShiftOperation;
}

interface RegisterProperties {
  name: string;
  size: Size;
  updateValueDirectly: (val: number) => void;
  get decimal (): number;
  get hexadecimal (): string;
  get binary (): string;
  set decimal (val: number);
  set hexadecimal (val: string);
  set binary (val: string);
}

export type Register = OperationsMethods & RegisterProperties & {
  size: RegisterSize;
};

export type SubRegister = RegisterProperties & {
  size: SubRegisterSize;
}

export type SubRegisters = {
  high: SubRegister;
  low: SubRegister;
};

export type DataRegister = Register & {
  subRegisters: SubRegisters;
}
