import { isLabel, type ProgramInstruction } from '@/core/shared/program';
import { STORAGE_KEYS } from './storageKeys';

/** The localStorage key of one architecture's program. */
export function programKey(architectureId: string): string {
  return `${STORAGE_KEYS.program}-${architectureId}`;
}

export function serializeProgram(program: readonly ProgramInstruction[]): string {
  return JSON.stringify(program);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A value an operand's field can hold: nothing nested, and no number JSON could not carry. */
function isPlain(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return value === null || typeof value === 'string' || typeof value === 'boolean';
}

/** Whether `line` has the shape of an instruction at all, before the architecture judges it. */
function isInstructionShaped(line: unknown): line is ProgramInstruction {
  if (!isRecord(line) || typeof line.mnemonic !== 'string' || !Array.isArray(line.operands)) {
    return false;
  }
  return line.operands.every(
    (operand: unknown) =>
      isRecord(operand) && typeof operand.type === 'string' && Object.values(operand).every(isPlain)
  );
}

/** Whether every label of the line names a line of a program this long, its end included. */
function labelsInRange(line: ProgramInstruction, length: number): boolean {
  return line.operands.every(
    (operand) =>
      !isLabel(operand) ||
      (Number.isInteger(operand.target) && operand.target >= 0 && operand.target <= length)
  );
}

/**
 * Reads a stored program back. Storage is not to be trusted: it may be cut off, edited by hand,
 * or written by an older version with other instructions. One line the architecture does not
 * accept and the whole program is dropped, since half a program is not the one that was saved.
 */
export function parseProgram<Instruction extends ProgramInstruction>(
  raw: string | null,
  isValid: (instruction: Instruction) => boolean
): Instruction[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const accepted = parsed.every(
      (line: unknown) =>
        isInstructionShaped(line) &&
        labelsInRange(line, parsed.length) &&
        isValid(line as Instruction)
    );
    return accepted ? (parsed as Instruction[]) : [];
  } catch {
    // Not JSON, or a line so malformed that the architecture's own check threw on it.
    return [];
  }
}

/**
 * The program saved for an architecture on the last visit. Storage that cannot be read, or holds
 * something else, gives an empty program.
 */
export function readStoredProgram<Instruction extends ProgramInstruction>(
  architectureId: string,
  isValid: (instruction: Instruction) => boolean
): Instruction[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(programKey(architectureId));
  } catch {
    // No storage here (a private window that blocks it, a test): nothing to restore.
  }
  return parseProgram(raw, isValid);
}

export function writeStoredProgram(
  architectureId: string,
  program: readonly ProgramInstruction[]
): void {
  try {
    localStorage.setItem(programKey(architectureId), serializeProgram(program));
  } catch {
    // Storage is full or blocked: the program still works, it is only not remembered.
  }
}
