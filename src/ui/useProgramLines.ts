import { shallowRef, ref } from 'vue';
import type { Instruction } from '@/core/x86/instructions';
import { insertLine, ipAfterInsert, ipAfterRemove, removeLine } from '@/core/x86/program';
import type { CpuState } from '@/core/x86/state';

/**
 * The program's lines and where new ones go. Editing keeps IP on the line it pointed at, and
 * calls `onEdit`, since an edited program can no longer redo what was undone.
 */
export function useProgramLines(state: CpuState, onEdit: () => void) {
  const program = shallowRef<Instruction[]>([]);
  /** Line that new program lines are inserted before; null means "append at the end". */
  const insertAt = ref<number | null>(null);

  function addToProgram(instruction: Instruction): void {
    const index = insertAt.value ?? program.value.length;
    onEdit();
    program.value = insertLine(program.value, index, instruction);
    state.registers.ip = ipAfterInsert(state.registers.ip, index);
    if (insertAt.value !== null) {
      insertAt.value++;
    }
  }

  function removeProgramLine(index: number): void {
    onEdit();
    program.value = removeLine(program.value, index);
    state.registers.ip = ipAfterRemove(state.registers.ip, index);
    if (insertAt.value !== null && insertAt.value > index) {
      insertAt.value--;
    }
  }

  /** Replaces the whole program, e.g. with an example, or with nothing; IP goes back to L0. */
  function replaceProgram(lines: readonly Instruction[]): void {
    onEdit();
    program.value = [...lines];
    insertAt.value = null;
    state.registers.ip = 0;
  }

  return { program, insertAt, addToProgram, removeProgramLine, replaceProgram };
}
