/**
 * The sentences that say why a flag holds its value, as templates (see `shared/text.ts`).
 * A key per sentence, so a translation is a table with the same keys.
 */
export const FLAG_REASON_TEXTS = {
  // Instructions that only change a flag
  clc: 'CLC clears CF.',
  stc: 'STC sets CF.',
  cmc: 'CMC flips CF.',
  cld: 'CLD clears DF: string instructions count up.',
  std: 'STD sets DF: string instructions count down.',
  cli: 'CLI clears IF: maskable interrupts are ignored.',
  sti: 'STI sets IF: maskable interrupts are allowed.',
  onlyChanges: '{name} only changes {flag}.',

  // ZF, SF and PF, which depend only on the result
  zero: 'The result {result} is zero.',
  notZero: 'The result {result} is not zero.',
  negative: 'Bit {top} of the result {result} is 1: as a signed number it is {signed}.',
  notNegative: 'Bit {top} of the result {result} is 0: not negative.',
  parityResultEven: 'The number of 1 bits in the result {byte} is {ones}, an even number.',
  parityResultOdd: 'The number of 1 bits in the result {byte} is {ones}, an odd number.',
  parityLowByteEven:
    'Only the low byte counts: the number of 1 bits in {byte} is {ones}, an even number.',
  parityLowByteOdd:
    'Only the low byte counts: the number of 1 bits in {byte} is {ones}, an odd number.',

  // Addition and subtraction
  neverCarry: '{name} never changes CF.',
  carryOut: '{sum} = {raw}h needs more than {size} bits: the carry out of bit {top} goes into CF.',
  noCarryOut: '{sum} = {result} fits in {size} bits, so nothing is carried out.',
  borrow: '{sum} needs a borrow: as unsigned numbers {a} is less than {b}.',
  noBorrow: '{sum} needs no borrow: as unsigned numbers {a} is at least {b}.',
  overflow:
    'As signed numbers {a} {operator} {b}{carry} = {exact}, outside {range}: the result {result} reads as {signed}.',
  noOverflow: 'As signed numbers {a} {operator} {b}{carry} = {exact}, which fits in {range}.',
  auxCarry: 'Low digits: {a}h {operator} {b}h{carry} = {raw}h, a carry out of bit 3.',
  noAuxCarry: 'Low digits: {a}h {operator} {b}h{carry} = {raw}h, no carry out of bit 3.',
  auxBorrow: 'Low digits: {a}h {operator} {b}h{carry} needs a borrow from bit 4.',
  noAuxBorrow: 'Low digits: {a}h {operator} {b}h{carry} needs no borrow from bit 4.',
  unchanged: '{name} does not change {flag}.',

  // Shifts and rotates
  shiftOverflowCount: 'OF is only defined for a count of 1; here it keeps its old value.',
  signChanged: 'The top bit went from {was} to {now}: the sign changed.',
  signKept: 'The top bit stayed {now}: the sign did not change.',
  shrOverflow: 'SHR by 1 copies the original top bit ({was}) into OF.',
  sarOverflow: 'SAR by 1 always clears OF: it keeps the sign bit.',
  rotateOverflow: 'OF is the XOR of the two top bits of the result ({first} and {second}).',
  shiftCarryTop: 'CF takes the last bit pushed out of the top of {original}: {carry}.',
  shiftCarryBottom: 'CF takes the last bit pushed out of the bottom of {original}: {carry}.',
  undefinedKept: '{name} leaves {flag} undefined on a real 8086; here it keeps its old value.',
  rotateOnly: 'Rotates only change CF and OF.',

  // Multiplication
  productSignedOverflow:
    'The product {product} does not fit in {low} as a signed number, so {high} holds part of it.',
  productSignedFits:
    'The product {product} fits in {low} as a signed number: {high} is only its sign.',
  productOverflow: 'The product {product} does not fit in {low}: {high} is not zero.',
  productFits: 'The product {product} fits in {low}: {high} is zero.',

  // Logic
  alwaysClears: '{name} always clears {flag}.',
  auxCleared: '{name} leaves AF undefined on a real 8086; here it is cleared.',

  // No ALU at all
  divideUndefined:
    '{name} leaves the flags undefined on a real 8086; here they keep their old values.',
  repeatZero: 'CX was 0, so the repeat compared nothing and the flags were left alone.',
  countZero: 'A count of 0 changes nothing, the flags included.',
  noFlagsChange: '{name} does not change the flags.',
  interruptClears: 'Entering an interrupt clears {flag}, so the handler is not itself interrupted.',
  restored: '{name} loads every flag from the FLAGS word it pops off the stack.'
} as const;

export type FlagReasonKey = keyof typeof FLAG_REASON_TEXTS;
