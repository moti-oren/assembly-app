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
import { warmth as byteWarmth } from '@/ui/memoryHeat';
import { columnGap, MEMORY_ROWS, rowStart, showsText } from '@/ui/memoryColumns';
import { useMemoryColumns } from '@/ui/useMemoryColumns';
import { writtenByte, type ByteChange } from '@/ui/stepDiff';
import ChangeMark from './ChangeMark.vue';
import InfoTip from './InfoTip.vue';
import RollingDigits from './RollingDigits.vue';
import WriteTip from './WriteTip.vue';

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
  /** The bytes the last instruction wrote, from what each held to what it holds now. */
  writes: ReadonlyMap<number, ByteChange>;
  /** The last load or store: its first byte, how many bytes it moved, and what it was in words. */
  access: { address: number; size: number; text: string } | null;
  /** How this memory is laid out, behind the info button. */
  intro: string;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

/** The box the table is drawn in: its width decides how many bytes a row holds. */
const well = ref<HTMLElement | null>(null);
const columns = useMemoryColumns(well);

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
  return memoryRows(props.byteAt, start.value, MEMORY_ROWS, columns.value);
});

const warmth = (address: number): string | undefined => byteWarmth(props.heat, address);

/** Bytes the last load or store touched. */
function accessed(address: number): boolean {
  const { access } = props;
  return !!access && address >= access.address && address < access.address + access.size;
}

function go(place: MemoryPlace): void {
  const address = place.start();
  // The stack grows down: its top goes on the last row, with what was pushed before it above.
  const first = place.stack
    ? Math.max(0, rowStart(address, columns.value) - (MEMORY_ROWS - 1) * columns.value)
    : address;
  addressText.value = hex(first);
}

function showStackTop(): void {
  const stack = props.places.find((place) => place.stack);
  if (stack) go(stack);
}

function showLastAccess(): void {
  if (props.access) addressText.value = hex(rowStart(props.access.address, columns.value));
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
            <span class="font-mono font-semibold">Bold</span> the program's machine code,
            <span class="font-mono underline decoration-dotted underline-offset-2">dotted</span>
            device registers. Colour is kept for the bytes an instruction reads and writes.
          </p>
        </InfoTip>
        <!-- On a phone the places are a row of their own, which scrolls sideways if it must. -->
        <div
          class="scroll-fade-x flex gap-1 max-sm:order-last max-sm:w-full max-sm:overflow-x-auto"
          role="group"
          aria-label="Go to"
        >
          <Button
            v-for="place in places"
            :key="place.label"
            variant="outline"
            size="sm"
            class="h-6 shrink-0 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground pointer-coarse:h-11 pointer-coarse:px-3.5"
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
            class="h-7 w-28 font-mono text-sm pointer-coarse:h-11"
            :class="[
              format.prefix.length > 1 ? 'pl-7' : 'pl-5',
              // A touch screen's field is set in 16px (controls.css): eight digits need more room.
              { 'pointer-coarse:w-36': format.digits > 4 }
            ]"
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
            class="relative ml-auto shrink-0 rounded-sm font-sans text-muted-foreground underline pointer-coarse:after:absolute pointer-coarse:after:-inset-3 pointer-coarse:after:content-[''] decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            @click="showLastAccess"
          >
            Show in table
          </button>
        </template>
      </p>

      <div ref="well" class="well overflow-auto rounded-lg px-2.5 py-1.5 max-sm:px-1.5">
        <table class="w-full font-mono text-xs whitespace-nowrap min-[100rem]:max-w-4xl">
          <thead>
            <tr class="text-muted-foreground">
              <!-- Eight bytes a row is a phone: the heading is cut to the width of an address. -->
              <th class="py-1 pr-3 text-left font-normal max-sm:pr-1.5">
                {{ columns === 16 ? 'address' : 'addr' }}
              </th>
              <th
                v-for="column in columns"
                :key="column"
                class="px-0.5 py-1 text-center font-normal"
                :class="{
                  'pl-3': columnGap(column - 1) === 'wide',
                  'pl-2': columnGap(column - 1) === 'narrow'
                }"
              >
                {{ (column - 1).toString(16).toUpperCase() }}
              </th>
              <th v-if="showsText(columns, format.digits)" class="py-1 pl-3 text-left font-normal">
                ascii
              </th>
            </tr>
          </thead>
          <tbody @mouseleave="pointed = null">
            <tr v-for="row in rows" :key="row[0].address">
              <th class="py-0.5 pr-3 text-left font-normal text-muted-foreground max-sm:pr-1.5">
                {{ hex(row[0].address) }}
              </th>
              <td
                v-for="(byte, column) in row"
                :key="byte.address"
                class="px-0.5 py-0.5 text-center"
                :class="{
                  'pl-3': columnGap(column) === 'wide',
                  'pl-2': columnGap(column) === 'narrow',
                  'font-semibold': byte.region === 'code',
                  'underline decoration-dotted underline-offset-2': byte.region === 'device'
                }"
                :title="
                  writes.has(byte.address)
                    ? undefined
                    : byte.value === null
                      ? `${formatAddress(format, byte.address)}: nothing is wired here`
                      : `${formatAddress(format, byte.address)} = ${byte.value}${byte.region === 'code' ? ', machine code' : byte.region === 'device' ? ', a device' : ''}`
                "
                @mouseenter="pointed = byte.address"
              >
                <span v-if="byte.value === null" class="text-tertiary-foreground">··</span>
                <WriteTip
                  v-else
                  :change="writtenByte(writes, byte.address)"
                  :label="formatAddress(format, byte.address)"
                >
                  <ChangeMark
                    :on="writtenByte(writes, byte.address)?.unchanged === false"
                    :written="writtenByte(writes, byte.address)?.unchanged"
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
                </WriteTip>
              </td>
              <!-- A character and its byte light up together, whichever one is pointed at. -->
              <td
                v-if="showsText(columns, format.digits)"
                class="py-0.5 pl-3 whitespace-pre text-muted-foreground"
              >
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
