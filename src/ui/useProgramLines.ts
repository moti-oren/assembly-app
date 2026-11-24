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
import { canChange, canMove, insertionAfterLock } from './programLock';
import { readStoredProgram, writeStoredProgram } from './programStorage';

/** Where a loaded program came from: an example, or a task of the comparison. */
export interface ProgramSource {
  name: string;
  description: string;
}

/**
 * The program's lines and where new ones go. Editing keeps the instruction pointer on the line
 * it pointed at, and calls `onEdit`, since an edited program can no longer redo what was undone.
 * `hasRun` says whether lines of the program have run and are still in the history. `lockedIn`
 * says how many lines at the top of a program are not the user's to change (a challenge's given
 * lines): they are not edited, moved or removed, and nothing is put above or between them.
 */
export function useProgramLines<
  Instruction extends ProgramInstruction,
  State extends CpuState,
  Record extends ExecutionRecord<Instruction>
>(
  architecture: Architecture<Instruction, State, Record>,
  state: State,
  onEdit: () => void,
  hasRun: () => boolean,
  lockedIn: (program: readonly Instruction[]) => number = () => 0
) {
  const program: ShallowRef<Instruction[]> = shallowRef([]);
  /** The line being edited in the builder, which replaces it; null when none is. */
  const editingLine = ref<number | null>(null);
  /** What the program was loaded from, for as long as it is still that program. */
  const source = ref<ProgramSource | null>(null);
  /**
   * True once lines were moved under a program that has already run. What the CPU holds from
   * that run, a return address on the stack or in a register, still names the old place.
   */
  const stale = ref(false);

  /** The last move of a line, for the panel to say: a move changes no text a reader would hear. */
  const lastMove = ref<{ from: number; to: number } | null>(null);

  /**
   * Swaps in an edited program, moving the instruction pointer as `moveLine` says. `shifts` is
   * false for an edit that leaves every existing line where it was.
   */
  /** An edit; `moveLine` says where the next line goes, and null leaves the pointer alone. */
  function edit(
    lines: Instruction[],
    moveLine: ((next: number) => number) | null,
    shifts = true
  ): void {
    const next = moveLine && moveLine(architecture.nextLine(state, program.value));
    if (shifts && hasRun()) stale.value = true;
    // Any other edit ends the last move's turn, so the same move made again is said again.
    lastMove.value = null;
    onEdit();
    source.value = null;
    // The line being edited may have moved or gone: the edit is dropped, the line is kept.
    editingLine.value = null;
    program.value = lines;
    if (next !== null) architecture.setNextLine(state, next, lines);
  }
  /** The program of the last visit, started afresh: no history comes back with it. */
  function restore(): void {
    const lines = readStoredProgram(architecture.id, architecture.isValid);
    if (lines.length === 0) return;
    program.value = lines;
    architecture.setNextLine(state, 0, lines);
  }

  /** How many lines at the top of the program are locked. */
  const locked = computed(() => lockedIn(program.value));

  /** Line that new program lines are inserted before; null means "append at the end". */
  const insertAt = ref<number | null>(null);

  /** Adds lines one after another at the insertion point, e.g. the two lines of a RISC-V `li`. */
  function addToProgram(instructions: readonly Instruction[]): void {
    insertAt.value = insertionAfterLock(insertAt.value, locked.value);
    for (const instruction of instructions) {
      const index = insertAt.value ?? program.value.length;
      // A line added at the end moves no other line.
      const shifts = index < program.value.length;
      edit(
        insertLine(program.value, index, instruction),
        (next) => lineAfterInsert(next, index),
        shifts
      );
      if (insertAt.value !== null) {
        insertAt.value++;
      }
    }
  }

  function removeProgramLine(index: number): void {
    if (!canChange(index, locked.value)) return;
    edit(removeLine(program.value, index), (next) => lineAfterRemove(next, index));
    if (insertAt.value !== null && insertAt.value > index) {
      insertAt.value--;
    }
  }

  /** Puts `instructions` in place of line `index`: what an edit of that line ends in. */
  function replaceProgramLine(index: number, instructions: readonly Instruction[]): void {
    if (index >= program.value.length || instructions.length === 0) return;
    if (!canChange(index, locked.value)) return;
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
    if (!canMove(from, to, locked.value)) return;
    edit(moveLine(program.value, from, to), (next) => lineAfterMove(next, from, to));
    lastMove.value = { from, to };
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
    const editable =
      index !== null && index < program.value.length && canChange(index, locked.value);
    editingLine.value = editable ? index : null;
  }

  /**
   * Replaces the whole program, e.g. with an example (its `from`), or with nothing; it starts
   * again at L0.
   */
  function replaceProgram(lines: readonly Instruction[], from: ProgramSource | null = null): void {
    edit([...lines], () => 0, false);
    stale.value = false;
    source.value = from;
    insertAt.value = null;
  }

  /**
   * Empties the program down to its first `kept` lines (a challenge's given lines). The CPU is
   * left as it is, its instruction pointer included: clearing the code does not run anything.
   */
  function clearProgram(kept: number): void {
    edit(program.value.slice(0, kept), null);
    insertAt.value = null;
  }

  restore();
  watch(program, (lines) => writeStoredProgram(architecture.id, lines));

  return {
    program,
    locked,
    source,
    stale,
    lastMove,
    insertAt,
    editing,
    editLine,
    replaceEditedLine,
    addToProgram,
    removeProgramLine,
    moveProgramLine,
    replaceProgram,
    clearProgram
  };
}
