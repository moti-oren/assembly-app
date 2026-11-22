<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { columnGap, MEMORY_ROWS, rowStart } from '@/ui/memoryColumns';
import { useMemoryColumns } from '@/ui/useMemoryColumns';
import { Layers } from '@lucide/vue';
import { formatPhysical } from '@/core/x86/address';
import { printable } from '@/core/shared/devices';
import type { ExecutionRecord } from '@/core/x86/execute';
import { formatHex, parseNumber } from '@/core/shared/numbers';
import type { SegmentRegister } from '@/core/x86/registers';
import type { CpuState } from '@/core/x86/state';
import { describeMemoryAccess } from '@/ui/describe';
import { warmth as byteWarmth } from '@/ui/memoryHeat';
import { writtenByte, type ByteChange } from '@/ui/stepDiff';
import { segmentRows, workedAddress } from '@/ui/x86MemoryView';
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
import AddressSum from './AddressSum.vue';
import ChangeMark from './ChangeMark.vue';
import InfoTip from './InfoTip.vue';
import RollingDigits from './RollingDigits.vue';
import WriteTip from './WriteTip.vue';

const props = defineProps<{
  state: CpuState;
  /** Recently written physical addresses, mapped to how many instructions ago (0 = the last). */
  heat: Map<number, number>;
  /** The last executed instruction: its memory access is the address worked out by default. */
  record: ExecutionRecord | null;
  /** The bytes the last instruction wrote. */
  writes: ReadonlyMap<number, ByteChange>;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

const SEGMENTS: SegmentRegister[] = ['ds', 'es', 'ss', 'cs'];

const segment = ref<SegmentRegister>('ds');
const offsetText = ref('0000');

/** The box the table is drawn in: its width decides how many bytes a row holds. */
const well = ref<HTMLElement | null>(null);
const columns = useMemoryColumns(well);

/** The offset box is always read as hex, with or without a 0x prefix or h suffix. */
const parsedOffset = computed(() => parseNumber(`0x${offsetText.value.replace(/^0x|h$/gi, '')}`));
const startOffset = computed(() => rowStart((parsedOffset.value ?? 0) & 0xffff, columns.value));
/** Text that is not a hex number shows the rows from 0000, and the box says it was not understood. */
const offsetInvalid = computed(() => offsetText.value.trim() !== '' && parsedOffset.value === null);
const offsetErrorId = useId();

const rows = computed(() => {
  // Reading memoryVersion makes this re-run after writes: the byte array itself is not reactive.
  void props.state.memoryVersion;
  const segmentValue = props.state.registers[segment.value];
  return segmentRows(props.state, segmentValue, startOffset.value, MEMORY_ROWS, columns.value);
});

const warmth = (address: number): string | undefined => byteWarmth(props.heat, address);

const lastAccess = computed(() => {
  void props.state.memoryVersion;
  return props.record && describeMemoryAccess(props.state, props.record);
});

/** Offset of the byte under the mouse, in the segment on show. */
const pointed = ref<number | null>(null);

/** The address being worked out: the pointed byte, or else the last instruction's access. */
const worked = computed(() =>
  workedAddress(
    pointed.value === null
      ? null
      : {
          segment: segment.value,
          segmentValue: props.state.registers[segment.value],
          offset: pointed.value
        },
    lastAccess.value || null
  )
);

function showLastAccess(): void {
  const access = lastAccess.value;
  if (!access) return;
  segment.value = access.segment;
  offsetText.value = formatHex(rowStart(access.offset, columns.value), 16);
}

function showStackTop(): void {
  segment.value = 'ss';
  const rowOfSp = rowStart(props.state.registers.sp, columns.value);
  offsetText.value = formatHex(rowOfSp - (MEMORY_ROWS - 1) * columns.value, 16);
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
        <CardTitle class="group-data-[size=sm]/card:text-base">Memory</CardTitle>
        <InfoTip label="About memory">
          Point at a byte, or run an instruction that uses memory, to see how its address is formed.
        </InfoTip>
        <!-- On a phone the two fields are a row of their own, half the width each. -->
        <div
          class="contents max-md:order-last max-md:grid max-md:w-full max-md:grid-cols-2 max-md:gap-2"
        >
          <Select v-model="segment">
            <SelectTrigger
              size="sm"
              class="w-36 font-mono max-md:w-full pointer-coarse:data-[size=sm]:h-11"
              aria-label="Segment"
            >
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
                <span class="text-muted-foreground">{{
                  formatHex(state.registers[name], 16)
                }}</span>
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
              class="h-7 w-28 pl-13 font-mono text-sm max-md:w-full pointer-coarse:h-11"
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
        </div>
        <Button
          variant="outline"
          size="sm"
          class="ml-auto pointer-coarse:h-11"
          @click="showStackTop"
        >
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
        <AddressSum v-else-if="worked" :worked="worked" @show="showLastAccess" />
      </p>

      <div ref="well" class="well overflow-auto rounded-lg px-2.5 py-1.5 max-sm:px-1.5">
        <table class="w-full font-mono text-xs whitespace-nowrap min-[100rem]:max-w-4xl">
          <thead>
            <tr class="text-muted-foreground">
              <th class="py-1 pr-3 text-left font-normal max-sm:pr-1.5">offset</th>
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
              <th class="py-1 pl-3 text-left font-normal">ascii</th>
            </tr>
          </thead>
          <tbody @mouseleave="pointed = null">
            <tr v-for="row in rows" :key="row.offset">
              <th class="py-0.5 pr-3 text-left font-normal text-muted-foreground max-sm:pr-1.5">
                {{ formatHex(row.offset, 16) }}
              </th>
              <td
                v-for="(byte, column) in row.bytes"
                :key="byte.address"
                class="px-0.5 py-0.5 text-center"
                :class="{
                  'pl-3': columnGap(column) === 'wide',
                  'pl-2': columnGap(column) === 'narrow'
                }"
                :title="
                  writes.has(byte.address)
                    ? undefined
                    : `Physical ${formatPhysical(byte.address)}h = ${byte.value}`
                "
                @mouseenter="pointed = (row.offset + column) & 0xffff"
              >
                <WriteTip
                  :change="writtenByte(writes, byte.address)"
                  :label="`Physical ${formatPhysical(byte.address)}h`"
                >
                  <ChangeMark
                    :on="writtenByte(writes, byte.address)?.unchanged === false"
                    :written="writtenByte(writes, byte.address)?.unchanged"
                    :tick="tick"
                    :data-loc="`mem:${byte.address}`"
                    :style="{ backgroundColor: warmth(byte.address) }"
                    :class="[
                      heat.get(byte.address) === 0
                        ? 'font-semibold'
                        : byte.value === 0
                          ? 'byte-zero'
                          : '',
                      { 'byte-pointed': pointed === ((row.offset + column) & 0xffff) }
                    ]"
                  >
                    <RollingDigits :text="formatHex(byte.value, 8)" />
                  </ChangeMark>
                </WriteTip>
              </td>
              <!-- A character and its byte light up together, whichever one is pointed at. -->
              <td class="py-0.5 pl-3 whitespace-pre text-muted-foreground">
                <span
                  v-for="(byte, column) in row.bytes"
                  :key="byte.address"
                  :class="{ 'byte-pointed': pointed === ((row.offset + column) & 0xffff) }"
                  @mouseenter="pointed = (row.offset + column) & 0xffff"
                  >{{ printable(byte.value) }}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>
