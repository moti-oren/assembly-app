<script setup lang="ts">
import { computed, ref } from 'vue';
import { Layers } from '@lucide/vue';
import { formatHex, parseNumber } from '@/core/numbers';
import type { SegmentRegister } from '@/core/registers';
import { physicalAddress, type CpuState } from '@/core/state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const props = defineProps<{
  state: CpuState;
  /** Physical addresses written by the last instruction. */
  highlight: Set<number>;
}>();

const ROWS = 8;
const COLUMNS = 16;
const SEGMENTS: SegmentRegister[] = ['ds', 'es', 'ss', 'cs'];

const segment = ref<SegmentRegister>('ds');
const offsetText = ref('0000');

const startOffset = computed(() => {
  // The offset box is always read as hex, with or without a 0x prefix or h suffix.
  const parsed = parseNumber(`0x${offsetText.value.replace(/^0x|h$/gi, '')}`);
  return parsed === null ? 0 : parsed & 0xfff0;
});

const rows = computed(() => {
  // Reading memoryVersion makes this re-run after writes: the byte array itself is not reactive.
  void props.state.memoryVersion;
  const segmentValue = props.state.registers[segment.value];
  const memory = props.state.memory;

  return Array.from({ length: ROWS }, (_, row) => {
    const offset = (startOffset.value + row * COLUMNS) & 0xffff;
    const bytes = Array.from({ length: COLUMNS }, (_, column) => {
      const address = physicalAddress(segmentValue, offset + column);
      return { address, value: memory[address] };
    });
    return { offset, bytes };
  });
});

function showStackTop(): void {
  segment.value = 'ss';
  const rowOfSp = props.state.registers.sp & 0xfff0;
  offsetText.value = formatHex(rowOfSp - (ROWS - 1) * COLUMNS, 16);
}

function ascii(value: number): string {
  return value >= 0x20 && value < 0x7f ? String.fromCharCode(value) : '·';
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Memory</CardTitle>
      <CardDescription
        >{{ ROWS * COLUMNS }} bytes from {{ segment.toUpperCase() }}:offset</CardDescription
      >
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <Select v-model="segment">
          <SelectTrigger size="sm" class="w-36 font-mono" aria-label="Segment">
            <SelectValue />
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
            maxlength="6"
            spellcheck="false"
            aria-label="Offset (hex)"
          />
        </div>
        <Button variant="outline" size="sm" class="ml-auto" @click="showStackTop">
          <Layers />
          Stack top
        </Button>
      </div>

      <div class="overflow-x-auto rounded-lg border bg-muted/30 px-2 py-1.5">
        <table class="w-full font-mono text-xs">
          <thead>
            <tr class="text-muted-foreground/80">
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
          <tbody>
            <tr v-for="row in rows" :key="row.offset">
              <th class="py-0.5 pr-3 text-left font-normal text-muted-foreground">
                {{ formatHex(row.offset, 16) }}
              </th>
              <td
                v-for="(byte, column) in row.bytes"
                :key="byte.address"
                class="px-0.5 py-0.5 text-center"
                :class="{ 'pl-2.5': column === 8 }"
                :title="`Physical ${byte.address.toString(16).toUpperCase().padStart(5, '0')}h = ${byte.value}`"
              >
                <span
                  class="rounded-sm px-0.5"
                  :class="
                    highlight.has(byte.address)
                      ? 'bg-changed font-semibold text-changed-foreground'
                      : byte.value === 0
                        ? 'text-muted-foreground/50'
                        : ''
                  "
                  >{{ formatHex(byte.value, 8) }}</span
                >
              </td>
              <td class="py-0.5 pl-3 whitespace-pre text-muted-foreground">
                {{ row.bytes.map((byte) => ascii(byte.value)).join('') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
</template>
