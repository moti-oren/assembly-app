<script setup lang="ts">
import { computed } from 'vue';
import {
  CYCLE_PHASES,
  OPERAND_KIND_LABELS,
  decode,
  type CyclePhase,
  type Decoded
} from '@/core/decode';
import type { ExecutionRecord } from '@/core/execute';
import { CATEGORY_LABELS, formatInstruction } from '@/core/instructions';
import { formatLabel } from '@/core/operands';
import { WORD_REGISTERS } from '@/core/registers';
import type { CpuState } from '@/core/state';
import type { PendingInstruction } from '@/ui/useCpu';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction: with nothing pending, the cycle rests on its execute phase. */
  record: ExecutionRecord | null;
  /** The program line being stepped by phase, if any. */
  pending: PendingInstruction | null;
}>();

const PHASE_LABELS: Record<CyclePhase, string> = {
  fetch: 'Fetch',
  decode: 'Decode',
  execute: 'Execute'
};

const active = computed<CyclePhase | null>(
  () => props.pending?.phase ?? (props.record ? 'execute' : null)
);

const instruction = computed(() => props.pending?.instruction ?? props.record?.instruction);

function list(items: (string | false)[]): string {
  return items.filter(Boolean).join(', ');
}

function describeDecode(decoded: Decoded): string {
  const size = decoded.size ? `, ${decoded.size}-bit` : '';
  const operands = decoded.operands
    .map(
      (operand) => `${operand.text} is the ${operand.role} (${OPERAND_KIND_LABELS[operand.kind]})`
    )
    .join(', ');
  const names = (registers: string[]) => registers.map((name) => name.toUpperCase());
  const reads = list([
    ...names(decoded.reads),
    decoded.memory.read && 'memory',
    decoded.readsFlags && 'the flags'
  ]);
  const writes = list([
    ...names(decoded.writes),
    decoded.memory.write && 'memory',
    decoded.writesFlags && 'the flags'
  ]);
  return [
    `${CATEGORY_LABELS[decoded.category]}${size}: ${decoded.description}.`,
    operands && `Here ${operands}.`,
    reads && `It will read ${reads}.`,
    writes && `It will write ${writes}.`
  ]
    .filter(Boolean)
    .join(' ');
}

function describeExecute(record: ExecutionRecord): string {
  const { registers, flags } = props.state;
  const changed = list([
    ...WORD_REGISTERS.filter(
      (name) => name !== 'ip' && registers[name] !== record.before.registers[name]
    ).map((name) => name.toUpperCase()),
    record.memoryWrites.length > 0 && 'memory',
    flags !== record.before.flags && 'the flags'
  ]);
  const effect = changed ? `It changed ${changed}.` : 'It changed no register, flag or memory.';
  if (record.line === null) {
    return `Run directly, so nothing was fetched from the program. ${effect}`;
  }
  const next = formatLabel(registers.ip);
  const jumped = registers.ip !== record.line + 1;
  return `${effect} ${jumped ? `It jumped: IP is now ${next}.` : `IP is at ${next}, the next line.`}`;
}

const detail = computed(() => {
  const { pending, record } = props;
  if (pending?.phase === 'fetch') {
    return `IP points at ${formatLabel(pending.line)}. That line is read out of the program, and IP moves on to ${formatLabel(pending.line + 1)} before anything runs.`;
  }
  if (pending) return describeDecode(decode(pending.instruction));
  if (record) return describeExecute(record);
  return 'Every instruction is fetched, decoded, then executed. Use the Fetch button below to walk a program line through the three phases.';
});
</script>

<template>
  <div class="rounded-lg border bg-muted/30 px-3 py-2.5">
    <div class="flex items-center gap-3">
      <span class="text-sm font-medium">Cycle</span>
      <ol class="flex items-center gap-1 text-xs" aria-label="Instruction cycle">
        <li
          v-for="(phase, index) in CYCLE_PHASES"
          :key="phase"
          class="flex items-center gap-1"
          :aria-current="phase === active ? 'step' : undefined"
        >
          <span
            v-if="index > 0"
            class="h-0.5 w-3 rounded-full bg-foreground/15"
            aria-hidden="true"
          />
          <span
            class="rounded-md border px-2 py-0.5 transition-colors duration-300"
            :class="
              phase !== active
                ? 'text-muted-foreground'
                : phase === 'execute'
                  ? 'border-transparent bg-changed font-semibold text-changed-foreground'
                  : 'border-transparent bg-pointer font-semibold text-pointer-foreground'
            "
            >{{ PHASE_LABELS[phase] }}</span
          >
        </li>
      </ol>
      <span class="ml-auto truncate font-mono text-xs text-muted-foreground">{{
        instruction ? formatInstruction(instruction) : 'idle'
      }}</span>
    </div>
    <!-- Three lines, whatever the text, so the panels below never move. -->
    <p
      class="mt-2 line-clamp-3 h-12 text-xs leading-4 text-muted-foreground"
      :title="detail"
      aria-live="polite"
    >
      {{ detail }}
    </p>
  </div>
</template>
