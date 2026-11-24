import type { Width } from './logic/alu';
import { allBits, type RegisterRequest } from './logic/register';
import type { RegisterFileRequest } from './logic/registerFile';

/** One register an instruction wrote, as the clock cycle of its flip-flops. */
export interface RegisterWrite {
  /** The CPU's name for the register the flip-flops belong to: `AX`. */
  register: string;
  /** The part of it the instruction named, when it wrote only that: `AL`. */
  part: string | null;
  request: RegisterRequest;
}

/**
 * The registers of a CPU that picks the one to write by an address, as the instruction found
 * them: the address and the value it sent, and whether it asked for a write at all.
 */
export interface RegisterFileView {
  request: RegisterFileRequest;
  /** The CPU's name for each register, by its address. */
  names: readonly string[];
}

/** The registers one executed instruction wrote. */
export interface RegisterView {
  writes: RegisterWrite[];
  note: string | null;
  /** Left out by a CPU whose registers are not picked by an address. */
  file?: RegisterFileView;
}

/** An instruction with no register to show, and why. */
export interface NoRegisterView {
  unavailable: string;
  /** There for a write that no register kept, as one to RISC-V's x0. */
  file?: RegisterFileView;
}

/** Where an executed instruction leads in the storage topic. */
export type RegisterLink = RegisterView | NoRegisterView;

export function hasRegisters(link: RegisterLink): link is RegisterView {
  return 'writes' in link;
}

/** A register whose bits in `enabled` took the value it has afterwards. */
export function written(
  register: string,
  width: Width,
  before: number,
  after: number,
  enabled = allBits(width),
  part: string | null = null
): RegisterWrite {
  return { register, part, request: { width, held: before, input: after, enabled } };
}

/** Said of an instruction that ran before the CPU's history kept what each one left behind. */
export const NOT_KEPT = 'What this instruction left in the registers was not kept.';

/**
 * Said of an instruction that wrote none of the registers shown. The instruction pointer is a
 * register as well, but it is loaded on every instruction, by the part of the CPU that fetches
 * the next one, which the control topic shows for RISC-V alone; elsewhere that, and the flags,
 * are not shown yet. `flags` names the flags register when the instruction changed it.
 */
export function nothingWritten(name: string, pointer: string, flags: string | null): string {
  return flags
    ? `${name} wrote no register but ${flags}. The flags, and ${pointer}, which every instruction loads, are not shown here yet.`
    : `${name} wrote no register. ${pointer}, which every instruction loads, is not shown here yet.`;
}
