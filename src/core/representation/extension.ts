import { signedOf, span, wrap, type Width } from './readings';

/** A narrow value made wide, as a load of a byte into a 32-bit register does. */
export interface ExtensionRequest {
  kind: 'extend';
  value: number;
  /** How many bits the value has, and how many it is given. */
  from: number;
  to: Width;
  /** True to copy the top bit into the new bits, false to fill them with 0. */
  signed: boolean;
}

export interface ExtensionSolution {
  request: ExtensionRequest;
  /** The narrow value's bits. */
  value: number;
  result: number;
  /** The narrow value's top bit, and the bit every new place is given. */
  top: 0 | 1;
  fill: 0 | 1;
  before: { unsigned: number; signed: number };
  after: { unsigned: number; signed: number };
}

export function solveExtension(request: ExtensionRequest): ExtensionSolution {
  const { from, to, signed } = request;
  const value = wrap(request.value, from);
  const top = value >= span(from - 1) ? 1 : 0;
  const fill = signed ? top : 0;
  const result = fill ? value + (span(to) - span(from)) : value;
  return {
    request,
    value,
    result,
    top,
    fill,
    before: { unsigned: value, signed: signedOf(value, from) },
    after: { unsigned: result, signed: signedOf(result, to) }
  };
}
