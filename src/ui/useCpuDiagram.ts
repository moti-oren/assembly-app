import { computed, reactive } from 'vue';
import { explainAddress } from '@/core/x86/address';
import { CYCLE_PHASES } from '@/core/shared/cycle';
import { decode } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import { isFlagSet, type FlagName } from '@/core/x86/flags';
import type { Instruction } from '@/core/x86/instructions';
import { WORD_REGISTERS, type RegisterName, type WordRegister } from '@/core/x86/registers';
import type { CpuState } from '@/core/x86/state';
import {
  aluUse,
  describeEquation,
  describeMemoryAccess,
  describePortAccess,
  registersRead,
  registersWritten,
  wasWritten
} from './describe';
import { adderNote, aluNote, busText, planNote } from './diagramNotes';
import { useLocale } from './useLocale';
import type { PendingInstruction } from './usePhaseStepping';

/** How the last instruction used a connection: lit as a read, lit as a write, or not at all. */
export type WireKind = 'read' | 'write' | undefined;

export interface CpuDiagramInput {
  state: CpuState;
  /** The last executed instruction: it decides which wires light up. */
  record: ExecutionRecord | null;
  /** A program line being stepped by phase: until it executes, the wires show its plan. */
  pending: PendingInstruction<Instruction> | null;
  /** Number of instructions executed so far. */
  tick: number;
}

/**
 * Everything the CPU diagram shows, worked out from the CPU and the last instruction: what each
 * box says and which wires light up. Its parts read it as one reactive object.
 */
export function useCpuDiagram(input: CpuDiagramInput) {
  const { t } = useLocale();
  /** While a line is part-way through its cycle nothing has run yet, so no change is on show. */
  const shown = computed(() => (input.pending ? null : input.record));
  const phase = computed(() => input.pending?.phase ?? null);
  const decoded = computed(() =>
    input.pending?.phase === 'decode' ? decode(input.pending.instruction) : null
  );

  /** Changes with every phase as well as every execution, so each one lights the wires afresh. */
  const pulse = computed(() => {
    const phaseStep = input.pending ? CYCLE_PHASES.indexOf(input.pending.phase) + 1 : 0;
    return input.tick * CYCLE_PHASES.length + phaseStep;
  });

  const equation = computed(() => shown.value && describeEquation(input.state, shown.value));
  const alu = computed(() => {
    if (decoded.value) return { input: decoded.value.usesAlu, output: false };
    return shown.value ? aluUse(shown.value) : { input: false, output: false };
  });
  const memory = computed(() =>
    shown.value ? describeMemoryAccess(input.state, shown.value) : null
  );
  const port = computed(() => (shown.value ? describePortAccess(input.state, shown.value) : null));
  /** The sum the address adder worked out for the memory access. A port number skips the adder. */
  const address = computed(() =>
    memory.value ? explainAddress(memory.value.segmentValue, memory.value.offset) : null
  );

  const read = computed(() => {
    // Fetch only looks at IP; decode selects the registers the instruction is going to read.
    if (phase.value === 'fetch') return new Set<WordRegister>(['ip']);
    if (decoded.value) return new Set<WordRegister>(decoded.value.reads);
    return shown.value ? registersRead(shown.value) : new Set<WordRegister>();
  });
  const written = computed(() =>
    shown.value ? registersWritten(shown.value) : new Set<WordRegister>()
  );

  const memoryPlanned = computed(() => {
    const plan = decoded.value?.memory;
    return plan !== undefined && (plan.read || plan.write);
  });
  const notes = computed(() => {
    const memoryPlan = memoryPlanned.value ? decoded.value?.memory : undefined;
    const portPlan = decoded.value?.port;
    return {
      alu: aluNote(t.value, phase.value, decoded.value, input.record, alu.value.input),
      adder: adderNote(
        t.value,
        phase.value,
        decoded.value,
        input.record,
        memoryPlanned.value,
        !!port.value
      ),
      memory: planNote(t.value, memoryPlan?.read ?? false, memoryPlan?.write ?? false),
      port: planNote(t.value, portPlan === 'read', portPlan === 'write')
    };
  });

  /** A wire is lit as planned during decode, and by what really crossed it after execute. */
  const adderKind = computed<WireKind>(() =>
    address.value || memoryPlanned.value ? 'read' : undefined
  );
  const memoryKind = computed<WireKind>(() => {
    if (memory.value) return memory.value.write ? 'write' : 'read';
    return memoryPlanned.value ? 'read' : undefined;
  });
  const portKind = computed<WireKind>(() => {
    if (port.value) return port.value.write ? 'write' : 'read';
    return decoded.value?.port ? 'read' : undefined;
  });
  const busKind = computed<WireKind>(() => memoryKind.value ?? portKind.value);
  const bus = computed(() => busText(t.value, memory.value, address.value, port.value));

  function value(name: WordRegister): number {
    return input.state.registers[name];
  }

  function changedBits(name: WordRegister): number {
    return shown.value ? shown.value.before.registers[name] ^ value(name) : 0;
  }

  /** Whether the last instruction wrote `name`, a register or one half of one. */
  function wrote(name: RegisterName): boolean {
    return wasWritten(shown.value, name);
  }

  /** A written register wins over a read one: `add ax, cx` reads AX but what matters is the write. */
  function use(name: WordRegister): WireKind {
    if (changedBits(name) !== 0 || written.value.has(name)) return 'write';
    return read.value.has(name) ? 'read' : undefined;
  }

  /** The bus between the two units carries whatever any register, the ALU or the adder used. */
  const internalKind = computed<WireKind>(() => {
    if (alu.value.output || WORD_REGISTERS.some((name) => use(name) === 'write')) return 'write';
    return read.value.size > 0 || alu.value.input || busKind.value ? 'read' : undefined;
  });

  const changedFlags = computed(() =>
    shown.value ? shown.value.before.flags ^ input.state.flags : 0
  );

  function isSet(flag: FlagName): boolean {
    return isFlagSet(input.state.flags, flag);
  }

  function flagChanged(flag: FlagName): boolean {
    return isFlagSet(changedFlags.value, flag);
  }

  return reactive({
    shown,
    pending: computed(() => input.pending),
    record: computed(() => input.record),
    pulse,
    equation,
    alu,
    memory,
    port,
    address,
    notes,
    adderKind,
    memoryKind,
    portKind,
    busKind,
    bus,
    internalKind,
    changedFlags,
    value,
    changedBits,
    wrote,
    use,
    isSet,
    flagChanged
  });
}

/** The diagram as its parts receive it. */
export type CpuDiagramModel = ReturnType<typeof useCpuDiagram>;
