import Instruction from "../lib/Instruction";

export const mov = new Instruction('', (dst: number, src: number) => {
  return src;
});

export const add = new Instruction('', (dst: number, src: number) => {
  return dst + src;
});

export const sub = new Instruction('', (dst: number, src: number) => {
  return dst - src;
});

export const mul = new Instruction('', (dst: number, src: number) => {
  return dst * src;
});

export const imul = new Instruction('', (dst: number, src: number) => {
  return dst * src; // TODO: Unsigned multiplication
});

export const div = new Instruction('', (dst: number, src: number) => {
  return dst / src;
});

export const idiv = new Instruction('', (dst: number, src: number) => {
  return dst / src; // TODO: Unsigned division
});

export const not = new Instruction('', (dst: number) => {
  return ~dst;
});

export const and = new Instruction('', (dst: number, src: number) => {
  return dst & src;
});

export const or = new Instruction('', (dst: number, src: number) => {
  return dst | src;
});

export const xor = new Instruction('', (dst: number, src: number) => {
  return dst ^ src;
});

export default {
  mov,
  add,
  sub,
  mul,
  imul,
  div,
  idiv,
  not,
  and,
  or,
  xor
}
