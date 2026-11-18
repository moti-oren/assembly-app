import type { Program } from '../shared/program';
import { modeOfInstruction, type Instruction } from './instructions';
import { OPERAND_BYTES } from './operands';
import { CODE_BASE } from './state';

/**
 * Where each program line sits in memory. A 6502 instruction is 1 to 3 bytes, so a line's
 * address depends on every line before it.
 */

/**
 * Bytes of one instruction: the opcode, then its operand. BRK is two: the CPU skips the byte after
 * it (a "signature" the handler may read), so returning from it lands on the next line.
 */
export function instructionSize(instruction: Instruction): number {
  const signature = instruction.mnemonic === 'brk' ? 1 : 0;
  return 1 + OPERAND_BYTES[modeOfInstruction(instruction)] + signature;
}

// A program is replaced, never changed in place, so its layout can be kept with it.
const layouts = new WeakMap<Program<Instruction>, number[]>();

/** The address of every line, and one past the end: where the program would continue. */
export function lineAddresses(program: Program<Instruction>): number[] {
  let addresses = layouts.get(program);
  if (!addresses) {
    addresses = [CODE_BASE];
    for (const instruction of program) {
      addresses.push(addresses.at(-1)! + instructionSize(instruction));
    }
    layouts.set(program, addresses);
  }
  return addresses;
}

export function addressOfLine(program: Program<Instruction>, line: number): number {
  return lineAddresses(program)[line] ?? lineAddresses(program).at(-1)!;
}

/** The program line starting at an address, or null when none starts there. */
export function lineAt(program: Program<Instruction>, address: number): number | null {
  const line = lineAddresses(program).indexOf(address);
  return line < 0 ? null : line;
}

/** Where the code ends: the first address after its last byte. */
export function codeEnd(program: Program<Instruction>): number {
  return lineAddresses(program).at(-1)!;
}
