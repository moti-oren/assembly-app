import { shallowRef, ref, type ShallowRef } from 'vue';
import type { Architecture } from '@/core/shared/architecture';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import {
  insertLine,
  lineAfterInsert,
  lineAfterRemove,
  removeLine,
  type ProgramInstruction
} from '@/core/shared/program';
import type { CpuState } from '@/core/shared/state';

/** Where a loaded program came from: an example, or a task of the comparison. */
export interface ProgramSource {
  name: string;
  description: string;
}

/**
 * The program's lines and where new ones go. Editing keeps the instruction pointer on the line
 * it pointed at, and calls `onEdit`, since an edited program can no longer redo what was undone.
 */
export function useProgramLines<
  Instruction extends ProgramInstruction,
  State extends CpuState,
  Record extends ExecutionRecord<Instruction>
>(architecture: Architecture<Instruction, State, Record>, state: State, onEdit: () => void) {
  const program: ShallowRef<Instruction[]> = shallowRef([]);
  /** What the program was loaded from, for as long as it is still that program. */
  const source = ref<ProgramSource | null>(null);

  /** Swaps in an edited program, moving the instruction pointer as `moveLine` says. */
  function edit(lines: Instruction[], moveLine: (next: number) => number): void {
    const next = moveLine(architecture.nextLine(state, program.value));
    onEdit();
    source.value = null;
    program.value = lines;
    architecture.setNextLine(state, next, lines);
  }
  /** Line that new program lines are inserted before; null means "append at the end". */
  const insertAt = ref<number | null>(null);

  /** Adds lines one after another at the insertion point, e.g. the two lines of a RISC-V `li`. */
  function addToProgram(instructions: readonly Instruction[]): void {
    for (const instruction of instructions) {
      const index = insertAt.value ?? program.value.length;
      edit(insertLine(program.value, index, instruction), (next) => lineAfterInsert(next, index));
      if (insertAt.value !== null) {
        insertAt.value++;
      }
    }
  }

  function removeProgramLine(index: number): void {
    edit(removeLine(program.value, index), (next) => lineAfterRemove(next, index));
    if (insertAt.value !== null && insertAt.value > index) {
      insertAt.value--;
    }
  }

  /**
   * Replaces the whole program, e.g. with an example (its `from`), or with nothing; it starts
   * again at L0.
   */
  function replaceProgram(lines: readonly Instruction[], from: ProgramSource | null = null): void {
    edit([...lines], () => 0);
    source.value = from;
    insertAt.value = null;
  }

  return { program, source, insertAt, addToProgram, removeProgramLine, replaceProgram };
}
