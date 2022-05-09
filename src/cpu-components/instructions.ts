import Instruction from "../lib/Instruction";

export const mov = new Instruction('mov', 0, ({ dst, src }: { dst: number, src: number }) => {
  return src;
});

export const inc = new Instruction('inc', 0, ({ dst }: { dst: number }) => {
  return dst + 1;
});

export const dec = new Instruction('dec', 0, ({ dst }: { dst: number }) => {
  return dst - 1;
});

export const add = new Instruction('add', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst + src;
});

export const sub = new Instruction('sub', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst - src;
});

export const mul = new Instruction('mul', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst * src;
});

export const imul = new Instruction('imul', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst * src; // TODO: Unsigned multiplication
});

export const div = new Instruction('div', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst / src;
});

export const idiv = new Instruction('idiv', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst / src; // TODO: Unsigned division
});

export const not = new Instruction('not', 0, ({ dst }: { dst: number }) => {
  return ~dst;
});

export const and = new Instruction('and', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst & src;
});

export const or = new Instruction('or', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst | src;
});

export const xor = new Instruction('xor', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst ^ src;
});

export const shr = new Instruction('shr', 0, ({ dst, src }: { dst: number, src: number }) => {
  return dst >> src;
});

export const shl = new Instruction('shl', 0, ({ dst, src }: { dst: number, src: number }) => {
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
