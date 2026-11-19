<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { Layers } from '@lucide/vue';
import { printable } from '@/core/shared/devices';
import { formatHex, parseNumber } from '@/core/shared/numbers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  formatAddress,
  memoryRows,
  type AddressFormat,
  type ByteAt,
  type MemoryPlace
} from '@/ui/flatMemory';
import { HEAT_STEPS } from '@/ui/useCpuHistory';
import { useTwoColumns } from '@/ui/useTwoColumns';
import ChangeMark from './ChangeMark.vue';
import InfoTip from './InfoTip.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  /** Its versions say when memory or a device changed: the byte arrays are not reactive. */
  state: { memoryVersion: number; ioVersion: number };
  byteAt: ByteAt;
  places: MemoryPlace[];
  format: AddressFormat;
  /** Where the panel starts. */
  initial: number;
  /** Recently written addresses, mapped to how many instructions ago (0 = the last). */
  heat: Map<number, number>;
  /** The last load or store: its first byte, how many bytes it moved, and what it was in words. */
  access: { address: number; size: number; text: string } | null;
  /** How this memory is laid out, behind the info button. */
  intro: string;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

const COMPACT_ROWS = 8;
const WIDE_ROWS = 16;
const COLUMNS = 16;
const twoColumns = useTwoColumns();
const rowCount = computed(() => (twoColumns.value ? WIDE_ROWS : COMPACT_ROWS));

const hex = (address: number) => formatAddress({ ...props.format, prefix: '' }, address);

// The first value only: after that the panel moves as the user asks.
const addressText = ref(hex(props.initial));
/** The address box is always read as hex, with or without its prefix. */
const parsed = computed(() =>
  parseNumber(`0x${addressText.value.trim().replace(/^(0x|\$)/i, '')}`)
);
const invalid = computed(() => addressText.value.trim() !== '' && parsed.value === null);
const errorId = useId();
const start = computed(() => (parsed.value ?? 0) >>> 0);

const rows = computed(() => {
  void props.state.memoryVersion;
  void props.state.ioVersion;
  return memoryRows(props.byteAt, start.value, rowCount.value);
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
  const { access } = props;
  return !!access && address >= access.address && address < access.address + access.size;
}

function go(place: MemoryPlace): void {
  const address = place.start();
  // The stack grows down: its top goes on the last row, with what was pushed before it above.
  const first = place.stack
    ? Math.max(0, (address & ~0xf) - (rowCount.value - 1) * COLUMNS)
    : address;
  addressText.value = hex(first);
}

function showStackTop(): void {
  const stack = props.places.find((place) => place.stack);
  if (stack) go(stack);
}

function showLastAccess(): void {
  if (props.access) addressText.value = hex(props.access.address & ~0xf);
}

/** The address of the byte under the mouse, in the hex columns or in the text beside them. */
const pointed = ref<number | null>(null);

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
        <CardTitle class="group-data-[size=sm]/card:text-base">Memory</CardTitle>
        <InfoTip label="About memory">
          <p>{{ intro }}</p>
          <p class="mt-2">
            <span class="font-mono text-pointer">blue</span> the program's machine code,
            <span class="font-mono text-written">orange</span> device registers.
          </p>
        </InfoTip>
        <div class="flex gap-1" role="group" aria-label="Go to">
          <Button
            v-for="place in places"
            :key="place.label"
            variant="outline"
            size="sm"
            class="h-6 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
            @click="go(place)"
          >
            <Layers v-if="place.stack" />
            {{ place.label }}
          </Button>
        </div>
        <div class="relative ml-auto">
          <span
            class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground"
            >{{ format.prefix }}</span
          >
          <Input
            v-model="addressText"
            class="h-7 w-28 font-mono text-sm"
            :class="format.prefix.length > 1 ? 'pl-7' : 'pl-5'"
            :aria-invalid="invalid || undefined"
            :aria-describedby="invalid ? errorId : undefined"
            :maxlength="format.digits + format.prefix.length"
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
          “{{ addressText }}” isn't a hex address (use 0–9 and A–F). Showing
          {{ formatAddress(format, 0) }}.
        </span>
        <template v-else-if="access">
          <span class="truncate">{{ access.text }}</span>
          <button
            type="button"
            class="ml-auto shrink-0 rounded-sm font-sans text-muted-foreground underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            @click="showLastAccess"
          >
            Show in table
          </button>
        </template>
      </p>

      <div class="well overflow-auto rounded-lg px-2.5 py-1.5">
        <table class="w-full font-mono text-xs whitespace-nowrap">
          <thead>
            <tr class="text-muted-foreground">
              <th class="py-1 pr-3 text-left font-normal">address</th>
              <th
                v-for="column in COLUMNS"
                :key="column"
                class="px-0.5 py-1 text-center font-normal"
                :class="{ 'pl-3': column === 9, 'pl-2': column === 5 || column === 13 }"
              >
                {{ (column - 1).toString(16).toUpperCase() }}
              </th>
              <th class="py-1 pl-3 text-left font-normal">ascii</th>
            </tr>
          </thead>
          <tbody @mouseleave="pointed = null">
            <tr v-for="row in rows" :key="row[0].address">
              <th class="py-0.5 pr-3 text-left font-normal text-muted-foreground">
                {{ hex(row[0].address) }}
              </th>
              <td
                v-for="(byte, column) in row"
                :key="byte.address"
                class="px-0.5 py-0.5 text-center"
                :class="{
                  'pl-3': column === 8,
                  'pl-2': column === 4 || column === 12,
                  'text-pointer': byte.region === 'code',
                  'text-written': byte.region === 'device'
                }"
                :title="
                  byte.value === null
                    ? `${formatAddress(format, byte.address)}: nothing is wired here`
                    : `${formatAddress(format, byte.address)} = ${byte.value}${byte.region === 'code' ? ', machine code' : byte.region === 'device' ? ', a device' : ''}`
                "
                @mouseenter="pointed = byte.address"
              >
                <span v-if="byte.value === null" class="text-tertiary-foreground">··</span>
                <ChangeMark
                  v-else
                  :on="heat.get(byte.address) === 0"
                  :tick="tick"
                  :data-loc="`mem:${byte.address}`"
                  :style="{ backgroundColor: warmth(byte.address) }"
                  :class="{
                    'byte-pointed': pointed === byte.address,
                    'font-semibold': heat.get(byte.address) === 0 || accessed(byte.address),
                    underline: accessed(byte.address),
                    'byte-zero': byte.value === 0 && byte.region === 'ram'
                  }"
                >
                  <RollingDigits :text="formatHex(byte.value, 8)" />
                </ChangeMark>
              </td>
              <!-- A character and its byte light up together, whichever one is pointed at. -->
              <td class="py-0.5 pl-3 whitespace-pre text-muted-foreground">
                <span
                  v-for="byte in row"
                  :key="byte.address"
                  :class="{ 'byte-pointed': pointed === byte.address }"
                  @mouseenter="pointed = byte.address"
                  >{{ byte.value === null ? ' ' : printable(byte.value) }}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>
