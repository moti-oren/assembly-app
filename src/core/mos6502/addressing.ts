import type { Index, Mode, Operand } from './operands';

/** How an instruction's address was formed, kept so it can be explained afterwards. */
export interface AddressTrace {
  mode: Mode;
  /** The address written in the instruction. */
  base: number;
  index: { register: Index; value: number } | null;
  /** For `($nn,X)`, `($nn),Y` and `JMP ($nnnn)`: where the pointer was read, and what it held. */
  pointer: { at: number; value: number } | null;
  /** The address the instruction ends up using. */
  address: number;
  /** Whether indexing carried into another page: some instructions take a cycle more for it. */
  pageCrossed: boolean;
}

/** What working out an address needs from the CPU. */
export interface AddressContext {
  index(register: Index): number;
  readByte(address: number): number;
}

const page = (address: number) => address & 0xff00;

/** A word in the zero page: its high byte wraps around to $00, never into page 1. */
function zeroPageWord(context: AddressContext, at: number): number {
  return context.readByte(at & 0xff) | (context.readByte((at + 1) & 0xff) << 8);
}

/**
 * The effective address of a memory operand. Zero-page indexing wraps within the zero page, and
 * `JMP ($xxFF)` reads its high byte from $xx00: the famous bug of the NMOS 6502.
 */
export function resolveAddress(
  context: AddressContext,
  operand: Operand,
  mode: Mode
): AddressTrace | null {
  if (!('address' in operand)) return null;
  const base = operand.address;
  const trace = (address: number, extra: Partial<AddressTrace> = {}): AddressTrace => ({
    mode,
    base,
    index: null,
    pointer: null,
    address,
    pageCrossed: false,
    ...extra
  });
  const indexed = (register: Index) => ({ register, value: context.index(register) });
  switch (mode) {
    case 'zpx':
    case 'zpy': {
      const index = indexed(mode === 'zpx' ? 'x' : 'y');
      return trace((base + index.value) & 0xff, { index });
    }
    case 'abx':
    case 'aby': {
      const index = indexed(mode === 'abx' ? 'x' : 'y');
      const address = (base + index.value) & 0xffff;
      return trace(address, { index, pageCrossed: page(address) !== page(base) });
    }
    case 'izx': {
      const index = indexed('x');
      const at = (base + index.value) & 0xff;
      const value = zeroPageWord(context, at);
      return trace(value, { index, pointer: { at, value } });
    }
    case 'izy': {
      const value = zeroPageWord(context, base);
      const index = indexed('y');
      const address = (value + index.value) & 0xffff;
      return trace(address, {
        index,
        pointer: { at: base, value },
        pageCrossed: page(address) !== page(value)
      });
    }
    case 'ind': {
      const high = page(base) | ((base + 1) & 0xff);
      const value = context.readByte(base) | (context.readByte(high) << 8);
      return trace(value, { pointer: { at: base, value } });
    }
    default:
      return trace(base);
  }
}
