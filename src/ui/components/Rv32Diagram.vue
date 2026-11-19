<script setup lang="ts">
import { computed } from 'vue';
import { formatHex32 } from '@/core/rv32/bits';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import type { REGISTER_KEYS } from '@/core/rv32/registers';
import type { CpuState } from '@/core/rv32/state';
import { datapathView } from '@/ui/rv32Datapath';
import { REGISTER_GROUPS, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/ui/rv32View';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import ChangeMark from './ChangeMark.vue';
import CpuCanvas from './CpuCanvas.vue';
import DatapathStage from './DatapathStage.vue';
import DiagramWire from './DiagramWire.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  state: CpuState;
  program: Instruction[];
  /** The last executed instruction: it decides which stages and registers light up. */
  record: ExecutionRecord | null;
  /** A program line being stepped by phase: until it executes, the stages show its plan. */
  pending: PendingInstruction<Instruction> | null;
  /** Number of instructions executed so far; replays the flashes. */
  tick: number;
}>();

const view = computed(() =>
  datapathView({
    state: props.state,
    program: props.program,
    record: props.pending ? null : props.record,
    pending: props.pending
  })
);

/** Changes with every phase as well as every execution, so each one lights the stages afresh. */
const pulse = computed(
  () => props.tick * 3 + (props.pending?.phase === 'decode' ? 2 : props.pending ? 1 : 0)
);

/** The five stages in the order an instruction passes through them. */
const STAGES = [
  { key: 'fetch', title: 'Fetch', tag: 'IF' },
  { key: 'decode', title: 'Decode', tag: 'ID' },
  { key: 'execute', title: 'Execute', tag: 'EX' },
  { key: 'memory', title: 'Memory', tag: 'MEM' },
  { key: 'writeBack', title: 'Write back', tag: 'WB' }
] as const;

function use(index: number): 'read' | 'write' | undefined {
  if (view.value.writes.includes(index)) return 'write';
  return view.value.reads.includes(index) ? 'read' : undefined;
}

function changed(key: (typeof REGISTER_KEYS)[number]): boolean {
  return (
    !props.pending &&
    !!props.record &&
    props.record.before.registers[key] !== props.state.registers[key]
  );
}
</script>

<template>
  <CpuCanvas>
    <div class="@container">
      <div class="chip-package rounded-lg p-3">
        <!--
          The register file: 32 registers with two read ports (rs1, rs2) and one write port (rd),
          set out by what the calling convention uses each for rather than by number.
        -->
        <section class="chip-block rounded-lg border px-3 py-2" aria-label="Register file">
          <h3 class="unit-title">Register file <span>x0–x31</span></h3>
          <div class="grid gap-x-6 gap-y-2 font-mono text-xs @min-[44rem]:grid-cols-2">
            <div v-for="group in REGISTER_GROUPS" :key="group.role">
              <h4
                class="mb-0.5 px-1 font-sans text-2xs text-muted-foreground"
                :title="ROLE_DESCRIPTIONS[group.role]"
              >
                {{ ROLE_LABELS[group.role] }}
              </h4>
              <div class="grid grid-cols-2 gap-x-1 @min-[26rem]:grid-cols-4">
                <div
                  v-for="row in group.rows"
                  :key="row.key"
                  class="flex h-5 items-center gap-1.5 rounded-sm px-1"
                  :class="{
                    'bg-pointer/15': use(row.index) === 'read',
                    'bg-written/20': use(row.index) === 'write'
                  }"
                  :title="`x${row.index}`"
                >
                  <span class="w-8 font-semibold">{{ row.abi }}</span>
                  <ChangeMark :on="changed(row.key)" :tick="tick" :data-loc="`reg:${row.key}`">
                    <RollingDigits :text="formatHex32(state.registers[row.key])" />
                  </ChangeMark>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!--
          The five stages, left to right as in a datapath drawing, each handing on to the next.
          Decode reads the register file above it and write back writes into it: those two wires.
        -->
        <div
          class="mt-2 grid gap-y-2 @min-[40rem]:mt-0 @min-[40rem]:grid-cols-[repeat(5,minmax(0,1fr))] @min-[40rem]:gap-x-4 @min-[40rem]:gap-y-0"
        >
          <template v-for="stage in STAGES" :key="`port-${stage.key}`">
            <DiagramWire
              v-if="stage.key === 'decode'"
              class="mx-auto hidden h-4 w-0.5 @min-[40rem]:block"
              :kind="view.reads.length > 0 ? 'read' : undefined"
              :tick="pulse"
              title="Decode reads rs1 and rs2 from the register file"
            />
            <DiagramWire
              v-else-if="stage.key === 'writeBack'"
              class="mx-auto hidden h-4 w-0.5 @min-[40rem]:block"
              :kind="view.writes.length > 0 ? 'write' : undefined"
              :tick="pulse"
              title="Write back writes rd into the register file"
            />
            <span v-else class="hidden h-4 @min-[40rem]:block" />
          </template>
          <div v-for="(stage, index) in STAGES" :key="stage.key" class="relative flex min-w-0">
            <DiagramWire
              v-if="index > 0"
              class="absolute top-1/2 -left-4 hidden w-4 @min-[40rem]:block"
              :kind="view[stage.key].use"
              :tick="pulse"
            />
            <DatapathStage
              class="min-h-24 flex-1"
              :title="stage.title"
              :tag="stage.tag"
              chip
              :stage="view[stage.key]"
              :tick="pulse"
            >
              <dl
                v-if="stage.key === 'decode' && view.decode.fields.length"
                class="mt-1 flex flex-wrap gap-1 font-mono text-2xs"
              >
                <div
                  v-for="field in view.decode.fields"
                  :key="field.name"
                  class="rounded-sm bg-foreground/8 px-1"
                >
                  <dt class="inline text-muted-foreground">{{ field.name }}</dt>
                  <dd class="ml-1 inline">{{ field.value }}</dd>
                </div>
              </dl>
            </DatapathStage>
          </div>
        </div>

        <div class="mt-2 flex items-center">
          <DiagramWire class="w-5 shrink-0" :kind="view.nextPc.use" :tick="pulse" />
          <DatapathStage
            class="flex-1"
            title="Next PC"
            tag="pc"
            :stage="view.nextPc"
            :tick="pulse"
          />
        </div>
      </div>
    </div>
  </CpuCanvas>
</template>
