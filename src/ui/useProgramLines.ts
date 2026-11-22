import { computed, shallowRef, ref, watch, type ShallowRef } from 'vue';
import type { Architecture } from '@/core/shared/architecture';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import {
  insertLine,
  lineAfterInsert,
  lineAfterMove,
  lineAfterRemove,
  lineAfterReplace,
  moveLine,
  removeLine,
  replaceLine,
  type ProgramInstruction
} from '@/core/shared/program';
import type { CpuState } from '@/core/shared/state';
import { parseProgram, programKey, serializeProgram } from './programStorage';

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
  /** The line being edited in the builder, which replaces it; null when none is. */
  const editingLine = ref<number | null>(null);
  /** What the program was loaded from, for as long as it is still that program. */
  const source = ref<ProgramSource | null>(null);

  /** Swaps in an edited program, moving the instruction pointer as `moveLine` says. */
  function edit(lines: Instruction[], moveLine: (next: number) => number): void {
    const next = moveLine(architecture.nextLine(state, program.value));
    onEdit();
    source.value = null;
    // The line being edited may have moved or gone: the edit is dropped, the line is kept.
    editingLine.value = null;
    program.value = lines;
    architecture.setNextLine(state, next, lines);
  }
  /**
   * The program as it was saved on the last visit, started afresh: no history comes back with it.
   * Storage that cannot be read, or holds something else, leaves the program empty.
   */
  function restore(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(programKey(architecture.id));
    } catch {
      // No storage here (a private window that blocks it, a test): nothing to restore.
    }
    const lines = parseProgram(raw, architecture.isValid);
    if (lines.length === 0) return;
    program.value = lines;
    architecture.setNextLine(state, 0, lines);
  }

  function save(lines: readonly Instruction[]): void {
    try {
      localStorage.setItem(programKey(architecture.id), serializeProgram(lines));
    } catch {
      // Storage is full or blocked: the program still works, it is only not remembered.
    }
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

  /** Puts `instructions` in place of line `index`: what an edit of that line ends in. */
  function replaceProgramLine(index: number, instructions: readonly Instruction[]): void {
    if (index >= program.value.length || instructions.length === 0) return;
    edit(replaceLine(program.value, index, instructions), (next) =>
      lineAfterReplace(next, index, instructions.length)
    );
    if (insertAt.value !== null && insertAt.value > index) {
      insertAt.value += instructions.length - 1;
    }
  }

  /** Moves a line to another place; the jumps that point at it follow. */
  function moveProgramLine(from: number, to: number): void {
    const last = program.value.length - 1;
    if (from === to || from < 0 || to < 0 || from > last || to > last) return;
    edit(moveLine(program.value, from, to), (next) => lineAfterMove(next, from, to));
    if (insertAt.value !== null) insertAt.value = lineAfterMove(insertAt.value, from, to);
  }

  /** The line being edited with the instruction it holds, for the builder to take up. */
  const editing = computed(() => {
    const line = editingLine.value;
    return line === null ? null : { line, instruction: program.value[line] };
  });

  /** Ends the edit by putting `instructions` in place of the line being edited. */
  function replaceEditedLine(instructions: readonly Instruction[]): void {
    if (editingLine.value !== null) replaceProgramLine(editingLine.value, instructions);
  }

  /** Starts editing a line in the builder, or stops with null; the line itself is untouched. */
  function editLine(index: number | null): void {
    editingLine.value = index !== null && index < program.value.length ? index : null;
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

  restore();
  watch(program, save);

  return {
    program,
    source,
    insertAt,
    editing,
    editLine,
    replaceEditedLine,
    addToProgram,
    removeProgramLine,
    moveProgramLine,
    replaceProgram
  };
}
