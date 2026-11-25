<script setup lang="ts">
import { computed } from 'vue';
import { ArrowDown, ArrowUp, Rewind, Undo2 } from '@lucide/vue';
import type { RegisterWrite } from '@/core/registerLink';
import { Button } from '@/components/ui/button';
import { hexOf } from '@/ui/logicView';
import {
  addressBits,
  decoderText,
  filePhaseText,
  fileRows,
  fileTitle,
  registerOf
} from '@/ui/storageFile';
import { CLOCK_ACTION } from '@/ui/storageView';
import { useHexStyle } from '@/ui/useHexStyle';
import type { StorageFile } from '@/ui/useStorageFile';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';
import StageSection from './StageSection.vue';

const props = defineProps<{ file: StorageFile }>();
const emit = defineEmits<{
  /** Show one register of the file as its own flip-flops. */
  show: [write: RegisterWrite];
}>();

const request = computed(() => props.file.request.value);
const solution = computed(() => props.file.solution.value);
const phase = computed(() => props.file.phase.value);
const clockHigh = computed(() => phase.value === 'high');
const address = computed(() => addressBits(request.value));
const hexStyle = useHexStyle();
const rows = computed(() =>
  fileRows(
    props.file.view.value,
    solution.value,
    phase.value,
    props.file.asRun.value,
    hexStyle.value
  )
);

const TONES = {
  changed: 'font-semibold text-changed-foreground',
  strong: 'font-semibold',
  plain: 'text-muted-foreground'
};

function open(index: number): void {
  const write = registerOf(props.file.view.value, solution.value, index);
  if (write) emit('show', write);
}
</script>

<!--
  The registers of a CPU side by side: an address picks one, a decoder turns it into that
  register's load line, and the clock they all share writes that one alone.
-->
<template>
  <StageSection :title="`Many registers: ${fileTitle(request)}`" label="The register file">
    <template #aside>
      <!-- It stays in place, and can keep the focus, when there is nothing to put back. -->
      <Button
        variant="ghost"
        size="sm"
        class="aria-disabled:cursor-default aria-disabled:text-tertiary-foreground aria-disabled:hover:bg-transparent pointer-coarse:h-11"
        :aria-disabled="!file.isEdited.value"
        @click="file.isEdited.value && file.restore()"
      >
        <Undo2 />
        {{ file.fromCpu.value ? 'Put back the CPU’s address' : 'Put back the starting address' }}
      </Button>
    </template>
    <template #lesson>
      Every register sees the same value at its inputs and the same clock. What picks the one that
      takes it is its write line, and a decoder turns that on: an AND gate per register, which reads
      the address and whether the instruction writes at all. Press a bit of the address, or the
      write line, to flip it. Its clock is the file's own: the register above is a circuit of its
      own with another, so each is stepped by itself.
    </template>

    <div class="logic-rows">
      <LogicBitNumbers :width="address.length" />
      <LogicRow
        label="Address"
        name="The address"
        mode="flip"
        :bits="address"
        @flip="file.flipAddress($event)"
      />
    </div>
    <div
      class="-mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 [--cell-height:2.25rem] [--cell:2.25rem] pointer-coarse:[--cell-height:2.75rem] pointer-coarse:[--cell:2.75rem]"
    >
      <span class="flex items-center gap-2 text-xs font-medium">
        Write
        <button
          type="button"
          class="logic-bit"
          :data-on="request.write ? '' : undefined"
          :aria-pressed="request.write === 1"
          aria-label="The write line"
          @click="file.flipWrite()"
        >
          {{ request.write }}
        </button>
      </span>
      <span class="flex items-center gap-2 text-xs font-medium">
        Value to write
        <span class="font-mono text-code tabular-nums">{{
          hexOf(request.input, request.width, hexStyle)
        }}</span>
      </span>
    </div>
    <p class="max-w-prose text-sm text-pretty" role="status">
      {{ decoderText(file.view.value, solution) }}
    </p>

    <ul
      class="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-1"
      aria-label="The registers, by address"
    >
      <li v-for="row in rows" :key="row.index">
        <button
          type="button"
          class="flex h-9 w-full items-center gap-2 rounded-md border bg-inset px-2 text-xs outline-none hover:border-foreground focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-default aria-disabled:hover:border-border pointer-coarse:h-11"
          :class="row.load ? 'border-foreground' : row.wired ? '' : 'border-wire'"
          :aria-disabled="row.wired"
          :aria-label="row.wired ? row.label : `${row.label}. Show its flip-flops`"
          @click="open(row.index)"
        >
          <span class="font-mono text-2xs text-tertiary-foreground">{{ row.address }}</span>
          <span class="min-w-8 text-left font-semibold">{{ row.name }}</span>
          <span class="font-mono text-code tabular-nums" :class="TONES[row.tone]">{{
            row.value
          }}</span>
          <span v-if="row.wired" class="ml-auto text-2xs text-tertiary-foreground">wired to 0</span>
          <span v-else class="ml-auto flex items-center gap-1 text-2xs text-tertiary-foreground">
            load
            <span class="logic-bit" data-tone="quiet" :data-on="row.load ? '' : undefined">{{
              row.load
            }}</span>
          </span>
        </button>
      </li>
    </ul>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button variant="outline" size="sm" class="pointer-coarse:h-11" @click="file.clock()">
        <ArrowDown v-if="clockHigh" />
        <ArrowUp v-else />
        {{ CLOCK_ACTION[phase] }}
      </Button>
      <span class="flex items-center gap-1.5 text-xs text-muted-foreground [--cell:1.875rem]">
        Clock
        <span class="logic-bit" :data-on="clockHigh ? '' : undefined" aria-hidden="true">{{
          clockHigh ? 1 : 0
        }}</span>
        <span class="sr-only">is {{ clockHigh ? 'high, 1' : 'low, 0' }}</span>
      </span>
      <!-- It stays in place, and can keep the focus, when there is nothing to go back to. -->
      <Button
        variant="ghost"
        size="sm"
        class="aria-disabled:cursor-default aria-disabled:text-tertiary-foreground aria-disabled:hover:bg-transparent pointer-coarse:h-11"
        :aria-disabled="phase === 'before'"
        @click="file.rewind()"
      >
        <Rewind />
        Rewind the clock
      </Button>
    </div>
    <p class="max-w-prose text-sm text-pretty" aria-live="polite">
      {{ filePhaseText(solution, phase) }}
    </p>
    <p class="max-w-prose text-xs text-pretty text-muted-foreground">
      Press a register to see its own flip-flops above: its load line is the write line of every one
      of its bits.
    </p>
  </StageSection>
</template>
