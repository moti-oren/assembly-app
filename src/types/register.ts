import { Names as InstructionsNames } from "./instruction";

export type Size = 8 | 16 | 32;

type UnaryOperation = (dst: Register) => void;
type BinaryOperation = (dst: Register, src: Register | number) => void;
type ShiftOperation = (amount: number) => void;

type Operations = {
  [I in keyof typeof InstructionsNames]: UnaryOperation | BinaryOperation | ShiftOperation;
}

type SubRegisters = {
  high: Register;
  low: Register;
};

export default interface Register extends Operations {
  name: string;
  size: Size;
  subRegisters?: SubRegisters;
  description: string;
  updateValueDirectly: (val: number) => void; // TODO
  get decimal (): number;
  get hexadecimal (): string;
  get binary (): string;
  set decimal (val: number);
  set hexadecimal (val: string);
  set binary (val: string);
}

export enum Names {
  ax = 'ax',
  bx = 'bx',
  cx = 'cx',
  dx = 'dx',
  si = 'si',
  di = 'di',
  bp = 'bp',
  sp = 'sp',
  ip = 'ip',
  cs = 'cs',
  ds = 'ds',
  ss = 'ss'
}
