<script setup lang="ts">
import { computed } from 'vue';
import { formatHex32 } from '@/core/rv32/bits';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import { ABI_NAMES, REGISTER_KEYS } from '@/core/rv32/registers';
import type { CpuState } from '@/core/rv32/state';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { datapathView } from '@/ui/rv32Datapath';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import ChangeMark from './ChangeMark.vue';
import CpuViewToggle from './CpuViewToggle.vue';
import DatapathStage from './DatapathStage.vue';
import DiagramWire from './DiagramWire.vue';
import RollingDigits from './RollingDigits.vue';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

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
  datapathView(t.value, {
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

/** x0..x31 in four columns of eight, the way a register file is numbered. */
const COLUMNS = [0, 8, 16, 24].map((first) =>
  REGISTER_KEYS.slice(first, first + 8).map((key, i) => ({ key, index: first + i }))
);

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
  <Card size="sm">
    <CardHeader>
      <CardTitle class="group-data-[size=sm]/card:text-base">CPU</CardTitle>
      <CardAction class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-pointer" aria-hidden="true" />
          {{ t.diagram.read }}
        </span>
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-written" aria-hidden="true" />
          {{ t.diagram.written }}
        </span>
        <CpuViewToggle />
      </CardAction>
    </CardHeader>

    <CardContent class="@container flex flex-col gap-3">
      <!-- The register file: 32 registers with two read ports (rs1, rs2) and one write port (rd). -->
      <section
        class="rounded-xl border border-foreground/20 bg-inset p-2.5"
        :aria-label="t.rv32.registerFile"
      >
        <h3 class="unit-title">{{ t.rv32.registerFile }} <span>x0–x31</span></h3>
        <div
          class="mt-1.5 grid gap-x-4 font-mono text-code @min-[30rem]:grid-cols-2 @min-[46rem]:grid-cols-4"
        >
          <div v-for="(column, c) in COLUMNS" :key="c">
            <div
              v-for="{ key, index } in column"
              :key="key"
              class="flex h-5 items-center gap-1.5 rounded-sm px-1"
              :class="{
                'bg-pointer/15': use(index) === 'read',
                'bg-written/20': use(index) === 'write'
              }"
            >
              <span class="w-9 font-semibold">{{ ABI_NAMES[index] }}</span>
              <ChangeMark :on="changed(key)" :tick="tick" :data-loc="`reg:${key}`">
                <RollingDigits :text="formatHex32(state.registers[key])" />
              </ChangeMark>
            </div>
          </div>
        </div>
      </section>

      <!-- The five stages every instruction goes through, left to right as in a datapath drawing. -->
      <div class="grid items-stretch gap-2 @min-[46rem]:grid-cols-[repeat(5,minmax(0,1fr))]">
        <DatapathStage :title="t.rv32.stages.fetch" tag="IF" :stage="view.fetch" :tick="pulse" />
        <DatapathStage :title="t.rv32.stages.decode" tag="ID" :stage="view.decode" :tick="pulse">
          <dl v-if="view.decode.fields.length" class="mt-1 flex flex-wrap gap-1 font-mono text-2xs">
            <div
              v-for="field in view.decode.fields"
              :key="field.name"
              class="rounded-sm bg-muted px-1"
            >
              <dt class="inline text-muted-foreground">{{ field.name }}</dt>
              <dd class="ml-1 inline">{{ field.value }}</dd>
            </div>
          </dl>
        </DatapathStage>
        <DatapathStage
          :title="t.rv32.stages.execute"
          tag="EX · ALU"
          :stage="view.execute"
          :tick="pulse"
        />
        <DatapathStage :title="t.rv32.stages.memory" tag="MEM" :stage="view.memory" :tick="pulse" />
        <DatapathStage
          :title="t.rv32.stages.writeBack"
          tag="WB"
          :stage="view.writeBack"
          :tick="pulse"
        />
      </div>

      <div class="flex items-center gap-2">
        <DiagramWire class="w-5 shrink-0" :kind="view.nextPc.use" :tick="pulse" />
        <DatapathStage
          class="flex-1"
          :title="t.rv32.stages.nextPc"
          tag="pc"
          :stage="view.nextPc"
          :tick="pulse"
        />
      </div>
    </CardContent>
  </Card>
</template>
