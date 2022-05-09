import Register from "./register";

export type DstOperand = Register;
export type SrcOperand = Register | number;

export interface Operands {
  dst: DstOperand;
  src: SrcOperand;
}

export type NumericOperands = {
  dst: number;
  src: number;
}
