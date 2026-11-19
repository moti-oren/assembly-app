import { formatLabel } from '@/core/shared/program';
import type { Messages } from './messages/en';

/** Where the instruction on show comes from: the builder, a program line, or the last run. */
export type EncodingSource =
  { kind: 'draft' } | { kind: 'line' | 'lastLine'; line: number } | { kind: 'last' };

/** An instruction on show in the machine code panel, its machine code, and where it comes from. */
export interface EncodingShown<Instruction, Line> {
  instruction: Instruction;
  assembled: Line;
  where: EncodingSource;
}

/** Where the instruction on show comes from, in words. */
export function whereText(m: Messages, where: EncodingSource): string {
  const words = m.common.where;
  if (where.kind === 'draft' || where.kind === 'last') return words[where.kind];
  return words[where.kind](formatLabel(where.line));
}

export interface EncodingSources<Instruction, Line> {
  program: readonly Instruction[];
  /** The machine code of every program line. */
  lines: readonly Line[];
  /** The complete instruction sitting in the builder, if any. */
  draft: Instruction | null;
  /** A program line whose bytes were clicked. */
  inspected: number | null;
  /** The line the CPU runs next, or null once the program has finished. */
  next: number | null;
  last: { line: number | null; instruction: Instruction } | null;
}

/** Encodes an instruction as if it were the next line added to the program. */
export type EncodeNext<Instruction, Line> = (
  instruction: Instruction,
  program: readonly Instruction[]
) => Line;

/** What the machine code panel takes apart: the draft, else a program line, else the last run. */
export function chooseEncoding<Instruction, Line>(
  sources: EncodingSources<Instruction, Line>,
  encode: EncodeNext<Instruction, Line>
): EncodingShown<Instruction, Line> | null {
  const { program, lines, draft, last } = sources;
  if (draft) {
    return {
      instruction: draft,
      assembled: encode(draft, program),
      where: { kind: 'draft' }
    };
  }
  const line = sources.inspected ?? sources.next;
  if (line !== null && lines[line]) {
    return {
      instruction: program[line],
      assembled: lines[line],
      where: { kind: 'line', line }
    };
  }
  if (!last) return null;
  if (last.line !== null && lines[last.line]) {
    return {
      instruction: program[last.line],
      assembled: lines[last.line],
      where: { kind: 'lastLine', line: last.line }
    };
  }
  return {
    instruction: last.instruction,
    assembled: encode(last.instruction, program),
    where: { kind: 'last' }
  };
}
