import { UnaryInstruction, BinaryInstruction } from "../lib/Instruction";

export const mov = new BinaryInstruction('mov', 0, ({ dst, src }: { dst: number, src: number }) => {
  return src;
});

export const inc = new UnaryInstruction('inc', 0, ({ dst }: { dst: number }) => {
  return dst + 1;
});

export const dec = new UnaryInstruction('dec', 0, ({ dst }: { dst: number }) => {
  return dst - 1;
});

export const add = new BinaryInstruction('add', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst + src;
});

export const sub = new BinaryInstruction('sub', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst - src;
});

export const mul = new BinaryInstruction('mul', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst * src;
});

export const imul = new BinaryInstruction('imul', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst * src; // TODO: Unsigned multiplication
});

export const div = new BinaryInstruction('div', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst / src;
});

export const idiv = new BinaryInstruction('idiv', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst / src; // TODO: Unsigned division
});

export const not = new UnaryInstruction('not', 0, ({ dst }: { dst: number }) => {
  return ~dst;
});

export const and = new BinaryInstruction('and', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst & src;
});

export const or = new BinaryInstruction('or', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst | src;
});

export const xor = new BinaryInstruction('xor', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst ^ src;
});

export const shr = new BinaryInstruction('shr', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst >> src;
});

export const shl = new BinaryInstruction('shl', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst << src;
});

export default {
  mov,
  inc,
  dec,
  add,
  sub,
  mul,
  imul,
  div,
  idiv,
  not,
  and,
  or,
  xor,
  shr,
  shl
}

// TODO: Pass the opcode arguments
