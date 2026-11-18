<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { Layers } from '@lucide/vue';
import { printable } from '@/core/shared/devices';
import { formatHex, parseNumber } from '@/core/shared/numbers';
import { formatHex32 } from '@/core/rv32/bits';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import { SP } from '@/core/rv32/registers';
import { readRegister, type CpuState } from '@/core/rv32/state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { describeAccess } from '@/ui/rv32Explain';
import { MEMORY_PLACES, memoryRows, type MemoryPlace } from '@/ui/rv32View';
import { HEAT_STEPS } from '@/ui/useCpuHistory';
import { useTwoColumns } from '@/ui/useTwoColumns';
import ChangeMark from './ChangeMark.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  state: CpuState;
  program: Instruction[];
  /** Recently written addresses, mapped to how many instructions ago (0 = the last). */
  heat: Map<number, number>;
  record: ExecutionRecord | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

const COMPACT_ROWS = 8;
const WIDE_ROWS = 16;
const COLUMNS = 16;
const twoColumns = useTwoColumns();
const rowCount = computed(() => (twoColumns.value ? WIDE_ROWS : COMPACT_ROWS));

const addressText = ref(formatHex32(MEMORY_PLACES.data.start));
/** The address box is always read as hex, with or without a 0x prefix. */
const parsed = computed(() => parseNumber(`0x${addressText.value.replace(/^0x/i, '')}`));
const invalid = computed(() => addressText.value.trim() !== '' && parsed.value === null);
const errorId = useId();
const start = computed(() => (parsed.value ?? 0) >>> 0);

const rows = computed(() => {
  // These make the rows re-run after writes: the byte arrays themselves are not reactive.
  void props.state.memoryVersion;
  void props.state.ioVersion;
  return memoryRows(props.state, props.program, start.value, rowCount.value);
});

/** A write cools down over the next few instructions instead of vanishing at once. */
function warmth(address: number): string | undefined {
  const age = props.heat.get(address);
  if (!age) return undefined;
  const strength = Math.round((1 - age / HEAT_STEPS) * 70);
  return `color-mix(in oklch, var(--changed) ${strength}%, transparent)`;
}

/** Bytes the last load or store touched. */
function accessed(address: number): boolean {
  const access = props.record?.access;
  return !!access && address >= access.address && address < access.address + access.size;
}

const lastAccess = computed(() => props.record && describeAccess(props.record));

function go(place: MemoryPlace): void {
  if (place === 'stack') {
    showStackTop();
    return;
  }
  addressText.value = formatHex32(MEMORY_PLACES[place].start);
}

function showStackTop(): void {
  const rowOfSp = readRegister(props.state, SP) & ~0xf;
  addressText.value = formatHex32(Math.max(0, rowOfSp - (rowCount.value - 1) * COLUMNS));
}

function showLastAccess(): void {
  const access = props.record?.access;
  if (access) addressText.value = formatHex32(access.address & ~0xf);
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
        <div class="flex gap-1" role="group" aria-label="Go to">
          <Button
            v-for="(place, key) in MEMORY_PLACES"
            :key="key"
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs"
            @click="go(key)"
          >
            <Layers v-if="key === 'stack'" />
            {{ place.label }}
          </Button>
        </div>
        <div class="relative ml-auto">
          <span
            class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground"
            >0x</span
          >
          <Input
            v-model="addressText"
            class="h-7 w-28 pl-7 font-mono text-sm"
            :aria-invalid="invalid || undefined"
            :aria-describedby="invalid ? errorId : undefined"
            maxlength="10"
            autocomplete="off"
            autocapitalize="characters"
            autocorrect="off"
            spellcheck="false"
            aria-label="Address (hex)"
          />
        </div>
      </div>

      <p class="flex items-baseline gap-2 font-mono text-xs lg:h-5 lg:overflow-hidden">
        <span v-if="invalid" :id="errorId" class="font-sans text-destructive">
          “{{ addressText }}” isn't a hex address (use 0–9 and A–F). Showing 0x00000000.
        </span>
        <template v-else-if="lastAccess">
          <span class="truncate">{{ lastAccess }}</span>
          <button
            type="button"
            class="ml-auto shrink-0 rounded-sm font-sans text-muted-foreground underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            @click="showLastAccess"
          >
            Show in table
          </button>
        </template>
        <span v-else class="font-sans text-muted-foreground">
          One flat space of 32-bit addresses: RAM from 0x00000000 (the code first), the devices at
          0x10000000. Dots mark addresses with nothing wired to them.
        </span>
      </p>

      <div class="overflow-auto rounded-lg border bg-muted/30 px-2 py-1.5">
        <table class="w-full font-mono text-xs">
          <thead>
            <tr class="text-muted-foreground">
              <th class="py-1 pr-3 text-left font-normal">address</th>
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
          <tbody>
            <tr v-for="row in rows" :key="row[0].address">
              <th class="py-0.5 pr-3 text-left font-normal text-muted-foreground">
                {{ formatHex32(row[0].address) }}
              </th>
              <td
                v-for="(byte, column) in row"
                :key="byte.address"
                class="px-0.5 py-0.5 text-center"
                :class="{
                  'pl-2.5': column === 8,
                  'text-pointer': byte.region === 'code',
                  'text-written': byte.region === 'device'
                }"
                :title="
                  byte.value === null
                    ? `${formatHex32(byte.address)}: nothing is wired here`
                    : `${formatHex32(byte.address)} = ${byte.value}${byte.region === 'code' ? ', machine code' : byte.region === 'device' ? ', a device' : ''}`
                "
              >
                <span v-if="byte.value === null" class="text-muted-foreground/50">··</span>
                <ChangeMark
                  v-else
                  :on="heat.get(byte.address) === 0"
                  :tick="tick"
                  :data-loc="`mem:${byte.address}`"
                  :style="{ backgroundColor: warmth(byte.address) }"
                  :class="{
                    'font-semibold': heat.get(byte.address) === 0 || accessed(byte.address),
                    underline: accessed(byte.address),
                    'text-muted-foreground': byte.value === 0 && byte.region === 'ram'
                  }"
                >
                  <RollingDigits :text="formatHex(byte.value, 8)" />
                </ChangeMark>
              </td>
              <td class="py-0.5 pl-3 whitespace-pre text-muted-foreground">
                {{
                  row.map((byte) => (byte.value === null ? ' ' : printable(byte.value))).join('')
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
        <span><span class="font-mono text-pointer">blue</span> the program's machine code</span>
        <span><span class="font-mono text-written">amber</span> device registers</span>
      </p>
    </CardContent>
  </Card>
</template>
