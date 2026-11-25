<script setup lang="ts">
import type { RegisterLink } from '@/core/registerLink';
import { rv32AluLink } from '@/core/rv32AluLink';
import { rv32NumberLink } from '@/core/rv32NumberLink';
import { computed, useTemplateRef } from 'vue';
import { formatHex32 } from '@/core/rv32/bits';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import type { REGISTER_KEYS } from '@/core/rv32/registers';
import type { CpuState } from '@/core/rv32/state';
import { rv32RegisterChange } from '@/ui/architectureDiffs';
import { datapathView } from '@/ui/rv32Datapath';
import { changeTitle, type ValueChange } from '@/ui/stepDiff';
import { REGISTER_GROUPS, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/ui/rv32View';
import { useGridKeys } from '@/ui/useGridKeys';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ChangeMark from './ChangeMark.vue';
import CpuCanvas from './CpuCanvas.vue';
import DatapathStage from './DatapathStage.vue';
import DiagramWire from './DiagramWire.vue';
import RollingDigits from './RollingDigits.vue';
import TapTooltip from './TapTooltip.vue';
import ValueDiff from './ValueDiff.vue';

const props = defineProps<{
  state: CpuState;
  program: Instruction[];
  /** The last executed instruction: it decides which stages and registers light up. */
  record: ExecutionRecord | null;
  /** The CPU as the last instruction left it: what that instruction did is told against it. */
  after: ExecutionRecord['before'] | null;
  /** A program line being stepped by phase: until it executes, the stages show its plan. */
  pending: PendingInstruction<Instruction> | null;
  /** Number of instructions executed so far; replays the flashes. */
  tick: number;
  /** Where the last instruction's write leads in the storage topic. */
  stored: RegisterLink | null;
  /** Why the control topic has nothing to show for it: null when it has; absent, no link. */
  control?: string | null;
}>();

// The 32 names are one stop for Tab, in the order drawn; the arrows move between them, so any
// register's role can be read from the keyboard without 32 stops on the way to the stages.
const ORDER = new Map(
  REGISTER_GROUPS.flatMap((group) => group.rows).map((row, at) => [row.key, at])
);
const names = useGridKeys(
  useTemplateRef<HTMLElement>('registerFile'),
  () => ({ rows: 32, columns: 1 }),
  {
    point: () => {},
    unpoint: () => {}
  }
);

const aluLink = computed(() => props.record && rv32AluLink(props.record));
const numberLink = computed(() => props.record && rv32NumberLink(props.record));

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

/** What the last instruction did to register `index`; none while a line is being stepped by phase. */
function change(index: number): ValueChange | null {
  return props.pending || !props.record || !props.after
    ? null
    : rv32RegisterChange(props.record, props.after, index);
}
</script>

<template>
  <CpuCanvas :alu="aluLink" :numbers="numberLink" :stored="stored" :control="control">
    <div class="@container">
      <div class="chip-package rounded-lg p-4">
        <!--
          The register file: 32 registers with two read ports (rs1, rs2) and one write port (rd),
          set out by what the calling convention uses each for rather than by number.
        -->
        <section
          ref="registerFile"
          class="chip-block rounded-lg border px-3 py-2"
          aria-label="Register file: the arrows move between the registers' names"
          @keydown="names.onKey"
        >
          <h3 class="unit-title">Register file <span>x0–x31</span></h3>
          <div class="grid gap-x-6 gap-y-2 font-mono text-xs @min-[44rem]:grid-cols-2">
            <div v-for="group in REGISTER_GROUPS" :key="group.role">
              <h4
                class="mb-1 px-1 font-sans text-2xs text-muted-foreground"
                :title="ROLE_DESCRIPTIONS[group.role]"
              >
                {{ ROLE_LABELS[group.role] }}
              </h4>
              <!-- As many columns as fit a whole register: a value never wraps under its name. -->
              <div class="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-x-1 gap-y-0.5">
                <div
                  v-for="row in group.rows"
                  :key="row.key"
                  class="flex h-5 items-center gap-1.5 rounded-sm px-1 whitespace-nowrap pointer-coarse:h-8"
                  :class="{
                    'bg-pointer/15': use(row.index) === 'read',
                    'bg-written/20': use(row.index) === 'write'
                  }"
                >
                  <!--
                    Its name tells what the register is for, and what the last instruction did to
                    it: on focus, hover or a tap.
                  -->
                  <TapTooltip v-slot="{ toggle }">
                    <TooltipTrigger as-child>
                      <span
                        :tabindex="names.stop.value === ORDER.get(row.key) ? 0 : -1"
                        :data-cell="ORDER.get(row.key)"
                        class="w-8 cursor-help rounded-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:inline-flex pointer-coarse:min-h-8 pointer-coarse:items-center"
                        @focus="names.onCellFocus(ORDER.get(row.key)!, 0)"
                        @click="toggle"
                        >{{ row.abi }}</span
                      >
                    </TooltipTrigger>
                    <TooltipContent class="flex-col items-start" side="top">
                      <p>{{ row.abi }} is x{{ row.index }}. {{ ROLE_DESCRIPTIONS[group.role] }}.</p>
                      <ValueDiff :change="change(row.index)" />
                    </TooltipContent>
                  </TapTooltip>
                  <ChangeMark
                    :on="changed(row.key)"
                    :written="change(row.index)?.unchanged"
                    :tick="tick"
                    :title="changeTitle(row.abi, change(row.index))"
                    :data-loc="`reg:${row.key}`"
                  >
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
          class="mt-2 grid gap-y-2 @min-[37rem]:mt-0 @min-[37rem]:grid-cols-[repeat(5,minmax(0,1fr))] @min-[37rem]:gap-x-4 @min-[37rem]:gap-y-0 @min-[44rem]:gap-x-5"
        >
          <template v-for="stage in STAGES" :key="`port-${stage.key}`">
            <DiagramWire
              v-if="stage.key === 'decode'"
              vertical
              class="mx-auto hidden h-4 @min-[37rem]:block"
              :kind="view.reads.length > 0 ? 'read' : undefined"
              :tick="pulse"
              title="Decode reads rs1 and rs2 from the register file"
            />
            <DiagramWire
              v-else-if="stage.key === 'writeBack'"
              vertical
              class="mx-auto hidden h-4 @min-[37rem]:block"
              :kind="view.writes.length > 0 ? 'write' : undefined"
              :tick="pulse"
              title="Write back writes rd into the register file"
            />
            <span v-else class="hidden h-4 @min-[37rem]:block" />
          </template>
          <div v-for="(stage, index) in STAGES" :key="stage.key" class="relative flex min-w-0">
            <DiagramWire
              v-if="index > 0"
              class="absolute top-1/2 -left-4 hidden w-4 @min-[37rem]:block @min-[44rem]:-left-5 @min-[44rem]:w-5"
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

        <!-- Under the stages and as wide as them: where the PC goes once the line is done. -->
        <DatapathStage class="mt-2" title="Next PC" tag="pc" :stage="view.nextPc" :tick="pulse" />
      </div>
    </div>
  </CpuCanvas>
</template>
