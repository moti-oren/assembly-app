import type { AssembledLine } from '@/core/x86/encode';
import { encode } from '@/core/x86/encode';
import type { ExecutionRecord } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';
import { formatLabel } from '@/core/shared/program';

/** An instruction on show in the machine code panel, and where it comes from. */
export interface EncodingShown {
  instruction: Instruction;
  assembled: AssembledLine;
  where: string;
}

export interface EncodingSources {
  program: readonly Instruction[];
  /** The machine code of every program line. */
  lines: readonly AssembledLine[];
  /** The complete instruction sitting in the builder, if any. */
  draft: Instruction | null;
  /** A program line whose bytes were clicked. */
  inspected: number | null;
  /** The line IP points at, or null once the program has finished. */
  next: number | null;
  last: ExecutionRecord | null;
}

/** What the machine code panel takes apart: the draft, else a program line, else the last run. */
export function chooseEncoding(sources: EncodingSources): EncodingShown | null {
  const { program, lines, draft, last } = sources;
  if (draft) {
    return {
      instruction: draft,
      assembled: encode(draft, program),
      where: 'as the next line of the program'
    };
  }
  const line = sources.inspected ?? sources.next;
  if (line !== null && lines[line]) {
    return {
      instruction: program[line],
      assembled: lines[line],
      where: `line ${formatLabel(line)}`
    };
  }
  if (!last) return null;
  if (last.line !== null && lines[last.line]) {
    return {
      instruction: program[last.line],
      assembled: lines[last.line],
      where: `line ${formatLabel(last.line)}, the last one run`
    };
  }
  return {
    instruction: last.instruction,
    assembled: encode(last.instruction, program),
    where: 'the last instruction run'
  };
}
