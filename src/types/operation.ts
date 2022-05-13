import Register from "./register";

export type DstOperand = Register;
export type SrcOperand = Register | number;

export interface UnaryOperands {
  dst: DstOperand;
}
export interface BinaryOperands {
  dst: DstOperand;
  src: SrcOperand;
}
