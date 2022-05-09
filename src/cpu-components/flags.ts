import Flag from "../lib/Flag";

const carry = new Flag('carry', false);
const zero = new Flag('zero', false);
const sign = new Flag('sign', false);
const parity = new Flag('parity', false);
const auxiliaryCarry = new Flag('auxiliaryCarry', false);
const overflow = new Flag('overflow', false);
const direction = new Flag('direction', false);
const interrupt = new Flag('interrupt', false);
const trace = new Flag('trace', false);

export default {
  carry,
  zero,
  sign,
  parity,
  auxiliaryCarry,
  overflow,
  direction,
  interrupt,
  trace
}
