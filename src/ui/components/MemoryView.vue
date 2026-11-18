<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { Layers } from '@lucide/vue';
import { explainAddress, formatPhysical } from '@/core/address';
import { printable } from '@/core/devices';
import type { ExecutionRecord } from '@/core/execute';
import { formatHex, parseNumber } from '@/core/numbers';
import type { SegmentRegister } from '@/core/registers';
import { physicalAddress, type CpuState } from '@/core/state';
import { describeMemoryAccess } from '@/ui/describe';
import { HEAT_STEPS } from '@/ui/useCpu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import ChangeMark from './ChangeMark.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  state: CpuState;
  /** Recently written physical addresses, mapped to how many instructions ago (0 = the last). */
  heat: Map<number, number>;
  /** The last executed instruction: its memory access is the address worked out by default. */
  record: ExecutionRecord | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

const COMPACT_ROWS = 8;
/** One 256-byte page. */
const WIDE_ROWS = 16;
const COLUMNS = 16;
const SEGMENTS: SegmentRegister[] = ['ds', 'es', 'ss', 'cs'];

const segment = ref<SegmentRegister>('ds');
const offsetText = ref('0000');

const twoColumns = useMediaQuery('(min-width: 64rem)');
const rowCount = computed(() => (twoColumns.value ? WIDE_ROWS : COMPACT_ROWS));

/** The offset box is always read as hex, with or without a 0x prefix or h suffix. */
const parsedOffset = computed(() => parseNumber(`0x${offsetText.value.replace(/^0x|h$/gi, '')}`));
const startOffset = computed(() => (parsedOffset.value ?? 0) & 0xfff0);
/** Text that is not a hex number shows the rows from 0000, and the box says it was not understood. */
const offsetInvalid = computed(() => offsetText.value.trim() !== '' && parsedOffset.value === null);
const offsetErrorId = useId();

const rows = computed(() => {
  // Reading memoryVersion makes this re-run after writes: the byte array itself is not reactive.
  void props.state.memoryVersion;
  const segmentValue = props.state.registers[segment.value];
  const memory = props.state.memory;

  return Array.from({ length: rowCount.value }, (_, row) => {
    const offset = (startOffset.value + row * COLUMNS) & 0xffff;
    const bytes = Array.from({ length: COLUMNS }, (_, column) => {
      const address = physicalAddress(segmentValue, offset + column);
      return { address, value: memory[address] };
    });
    return { offset, bytes };
  });
});

/** A write cools down over the next few instructions instead of vanishing at once. */
function warmth(address: number): string | undefined {
  const age = props.heat.get(address);
  if (!age) return undefined;
  const strength = Math.round((1 - age / HEAT_STEPS) * 70);
  return `color-mix(in oklch, var(--changed) ${strength}%, transparent)`;
}

const lastAccess = computed(() => {
  void props.state.memoryVersion;
  return props.record && describeMemoryAccess(props.state, props.record);
});

/** Offset of the byte under the mouse, in the segment on show. */
const pointed = ref<number | null>(null);

/** The address being worked out: the pointed byte, or else the last instruction's access. */
const worked = computed(() => {
  if (pointed.value !== null) {
    return {
      label: 'This byte',
      segment: segment.value,
      sum: explainAddress(props.state.registers[segment.value], pointed.value),
      offsetParts: null,
      isLastAccess: false
    };
  }
  const access = lastAccess.value;
  if (!access) return null;
  return {
    label: access.write ? 'Last write' : 'Last read',
    segment: access.segment,
    sum: explainAddress(access.segmentValue, access.offset),
    offsetParts: access.offsetParts,
    isLastAccess: true
  };
});

/** Where the offset came from, when a register supplied it. */
const offsetNote = computed(() => {
  const parts = worked.value?.offsetParts;
  if (!parts?.base) return null;
  const base = parts.base.toUpperCase();
  if (parts.displacement === 0) return `offset = ${base}`;
  const sum = `offset = ${base} ${formatHex(parts.baseValue, 16)}h + ${formatHex(parts.displacement, 16)}h`;
  return parts.wrapped ? `${sum}, wraps at 64K` : sum;
});

function showLastAccess(): void {
  const access = lastAccess.value;
  if (!access) return;
  segment.value = access.segment;
  offsetText.value = formatHex(access.offset & 0xfff0, 16);
}

function showStackTop(): void {
  segment.value = 'ss';
  const rowOfSp = props.state.registers.sp & 0xfff0;
  offsetText.value = formatHex(rowOfSp - (rowCount.value - 1) * COLUMNS, 16);
}

const card = ref<{ $el: HTMLElement } | null>(null);

/** For the command palette: jump, then bring the memory into view, which may be off screen. */
defineExpose({
  showStackTop: () => reveal(showStackTop),
  showLastAccess: () => reveal(showLastAccess)
});

function reveal(jump: () => void): void {
  jump();
  card.value?.$el.scrollIntoView({ block: 'nearest' });
}
</script>

<template>
  <Card ref="card" size="sm">
    <CardContent class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <CardTitle class="mr-1 group-data-[size=sm]/card:text-base">Memory</CardTitle>
        <Select v-model="segment">
          <SelectTrigger size="sm" class="w-36 font-mono" aria-label="Segment">
            <!-- Written out here: left to itself the trigger keeps the text the item had when it was picked. -->
            <SelectValue>
              {{ segment.toUpperCase() }}
              <span class="text-muted-foreground">{{
                formatHex(state.registers[segment], 16)
              }}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="name in SEGMENTS" :key="name" :value="name" class="font-mono">
              {{ name.toUpperCase() }}
              <span class="text-muted-foreground">{{ formatHex(state.registers[name], 16) }}</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <div class="relative">
          <span
            class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground"
            >Offset</span
          >
          <Input
            v-model="offsetText"
            class="h-7 w-28 pl-13 font-mono text-sm"
            :aria-invalid="offsetInvalid || undefined"
            :aria-describedby="offsetInvalid ? offsetErrorId : undefined"
            maxlength="6"
            autocomplete="off"
            autocapitalize="characters"
            autocorrect="off"
            spellcheck="false"
            aria-label="Offset (hex)"
          />
        </div>
        <Button variant="outline" size="sm" class="ml-auto" @click="showStackTop">
          <Layers />
          Stack top
        </Button>
      </div>

      <!--
        segment:offset worked out into the 20-bit address that goes onto the bus. An offset that
        cannot be read takes this line, so the message needs no row of its own.
      -->
      <p
        class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-mono text-xs lg:h-5 lg:flex-nowrap lg:overflow-hidden lg:whitespace-nowrap"
      >
        <span v-if="offsetInvalid" :id="offsetErrorId" class="font-sans text-destructive">
          “{{ offsetText }}” isn't a hex offset (use 0–9 and A–F, e.g. 1F0). Showing 0000.
        </span>
        <template v-else-if="worked">
          <span
            class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 lg:shrink-0 lg:flex-nowrap"
          >
            <span class="font-sans text-muted-foreground">{{ worked.label }}</span>
            <span class="font-semibold"
              >{{ worked.segment.toUpperCase() }}:{{ formatHex(worked.sum.offset, 16) }}</span
            >
            <span class="text-muted-foreground">=</span>
            <span :title="`${worked.segment.toUpperCase()} shifted left by 4 bits`"
              >{{ formatHex(worked.sum.segment, 16) }}h × 10h</span
            >
            <span class="text-muted-foreground">+</span>
            <span>{{ formatHex(worked.sum.offset, 16) }}h</span>
            <span class="text-muted-foreground">=</span>
            <template v-if="worked.sum.wrapped">
              <span class="text-muted-foreground line-through decoration-1"
                >{{ formatPhysical(worked.sum.sum) }}h</span
              >
              <span class="font-sans text-muted-foreground">wraps past 1MB to</span>
            </template>
            <span class="font-semibold text-pointer"
              >{{ formatPhysical(worked.sum.physical) }}h</span
            >
          </span>
          <span
            v-if="offsetNote"
            class="font-sans text-muted-foreground lg:min-w-0 lg:truncate"
            :title="offsetNote"
            >· {{ offsetNote }}</span
          >
          <button
            v-if="worked.isLastAccess"
            type="button"
            class="relative ml-auto shrink-0 rounded-sm font-sans text-muted-foreground underline pointer-coarse:after:absolute pointer-coarse:after:-inset-3 pointer-coarse:after:content-[''] decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            @click="showLastAccess"
          >
            Show in table
          </button>
        </template>
        <span v-else class="font-sans text-muted-foreground">
          Point at a byte, or run an instruction that uses memory, to see how its address is formed.
        </span>
      </p>

      <div class="overflow-auto rounded-lg border bg-muted/30 px-2 py-1.5">
        <table class="w-full font-mono text-xs">
          <thead>
            <tr class="text-muted-foreground">
              <th class="py-1 pr-3 text-left font-normal">offset</th>
              <th
                v-for="column in COLUMNS"
                :key="column"
                class="px-0.5 py-1 text-center font-normal"
                :class="{ 'pl-2.5': column === 9 }"
              >
                {{ (column - 1).toString(16).toUpperCase() }}
              </th>
              <th class="py-1 pl-3 text-left font-normal">ascii</th>
            </tr>
          </thead>
          <tbody @mouseleave="pointed = null">
            <tr v-for="row in rows" :key="row.offset">
              <th class="py-0.5 pr-3 text-left font-normal text-muted-foreground">
                {{ formatHex(row.offset, 16) }}
              </th>
              <td
                v-for="(byte, column) in row.bytes"
                :key="byte.address"
                class="px-0.5 py-0.5 text-center"
                :class="{ 'pl-2.5': column === 8 }"
                :title="`Physical ${formatPhysical(byte.address)}h = ${byte.value}`"
                @mouseenter="pointed = (row.offset + column) & 0xffff"
              >
                <ChangeMark
                  :on="heat.get(byte.address) === 0"
                  :tick="tick"
                  :data-loc="`mem:${byte.address}`"
                  :style="{ backgroundColor: warmth(byte.address) }"
                  :class="
                    heat.get(byte.address) === 0
                      ? 'font-semibold'
                      : byte.value === 0
                        ? 'text-muted-foreground'
                        : ''
                  "
                >
                  <RollingDigits :text="formatHex(byte.value, 8)" />
                </ChangeMark>
              </td>
              <td class="py-0.5 pl-3 whitespace-pre text-muted-foreground">
                {{ row.bytes.map((byte) => printable(byte.value)).join('') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>
