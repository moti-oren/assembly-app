import { computed, shallowRef, type Ref } from 'vue';
import { chooseEncoding, type EncodeNext } from './encodingShown';

/** What the CPU knows about its program, as a workbench gets it from `useCpu`. */
export interface ProgramState<Instruction> {
  program: Readonly<Ref<readonly Instruction[]>>;
  nextLine: Readonly<Ref<number>>;
  finished: Readonly<Ref<boolean>>;
  lastRecord: Readonly<Ref<{ line: number | null; instruction: Instruction } | null>>;
}

/** How one architecture writes an instruction as text and as machine code. */
export interface InstructionCoding<Instruction, Line> {
  format: (instruction: Instruction) => string;
  assemble: (program: readonly Instruction[]) => { lines: Line[] };
  encode: EncodeNext<Instruction, Line>;
}

/**
 * The program as text and as machine code, the instruction sitting in the builder, and the one the
 * machine code panel takes apart.
 */
export function useProgramCode<Instruction, Line>(
  cpu: ProgramState<Instruction>,
  inspectedLine: Readonly<Ref<number | null>>,
  coding: InstructionCoding<Instruction, Line>
) {
  const programLines = computed(() => cpu.program.value.map((line) => coding.format(line)));
  /** The machine code of every program line; the program itself is never run from these bytes. */
  const assembled = computed(() => coding.assemble(cpu.program.value));
  /** The complete instruction sitting in the builder, if any. */
  const draft = shallowRef<Instruction | null>(null);

  const encodingShown = computed(() =>
    chooseEncoding(
      {
        program: cpu.program.value,
        lines: assembled.value.lines,
        draft: draft.value,
        inspected: inspectedLine.value,
        next: cpu.finished.value ? null : cpu.nextLine.value,
        last: cpu.lastRecord.value
      },
      coding.encode
    )
  );

  return { programLines, assembled, draft, encodingShown };
}
