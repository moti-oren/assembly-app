/**
 * The 32 integer registers, x0 to x31. They are all alike to the hardware, except that x0 always
 * reads as 0; the names after them (a0, sp, ...) come from the calling convention, the ABI.
 */
// prettier-ignore
export const REGISTER_KEYS = [
  'x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7',
  'x8', 'x9', 'x10', 'x11', 'x12', 'x13', 'x14', 'x15',
  'x16', 'x17', 'x18', 'x19', 'x20', 'x21', 'x22', 'x23',
  'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30', 'x31'
] as const;

/** The registers in the CPU state: x0..x31 and the program counter. */
export type RegisterName = (typeof REGISTER_KEYS)[number] | 'pc';

// prettier-ignore
export const ABI_NAMES = [
  'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
  's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
  'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
  's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'
] as const;

export const ZERO = 0;
export const RA = 1;
export const SP = 2;

/** What each register is for, by the calling convention. */
export type RegisterRole = 'special' | 'argument' | 'temporary' | 'saved';

export function registerRole(index: number): RegisterRole {
  const name = ABI_NAMES[index];
  if (index < 5) return 'special';
  if (name.startsWith('a')) return 'argument';
  if (name.startsWith('t')) return 'temporary';
  return 'saved';
}

export function registerKey(index: number): (typeof REGISTER_KEYS)[number] {
  return REGISTER_KEYS[index];
}

/** A register by any name an assembler accepts: `x10`, `a0`, or `fp` for s0. */
export function parseRegister(text: string): number | null {
  const name = text.trim().toLowerCase();
  if (name === 'fp') return 8;
  const abi = (ABI_NAMES as readonly string[]).indexOf(name);
  if (abi >= 0) return abi;
  const match = /^x([0-9]|[12][0-9]|3[01])$/.exec(name);
  return match ? Number(match[1]) : null;
}
