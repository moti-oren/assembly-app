<script setup lang="ts">
import { computed } from 'vue';
import { formatBits } from '@/core/shared/numbers';
import { formatHex32 } from '@/core/rv32/bits';
import type { AssembledLine, FieldName } from '@/core/rv32/encode';
import { formatInstruction, type Instruction } from '@/core/rv32/instructions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EncodingShown } from '@/ui/encodingShown';

const props = defineProps<{
  /** The instruction on show with its machine code, or null when there is nothing to encode. */
  shown: EncodingShown<Instruction, AssembledLine> | null;
}>();

/** Each kind of field in its own colour, the same in the strip and in the list below it. */
const FIELD_COLOURS: Record<FieldName, string> = {
  opcode: 'bg-chart-1/25 border-chart-1/60',
  rd: 'bg-chart-2/25 border-chart-2/60',
  funct3: 'bg-chart-3/25 border-chart-3/60',
  funct7: 'bg-chart-3/25 border-chart-3/60',
  rs1: 'bg-chart-4/25 border-chart-4/60',
  rs2: 'bg-chart-4/25 border-chart-4/60',
  imm: 'bg-chart-5/25 border-chart-5/60'
};

const BITS = Array.from({ length: 32 }, (_, i) => 31 - i);

const encoding = computed(() => props.shown?.assembled.encoding ?? null);

const summary = computed(() => {
  if (!props.shown) return null;
  const { address, encoding: code } = props.shown.assembled;
  return `${code.format}-type, 4 bytes at 0x${formatHex32(address)}, ${props.shown.where}`;
});

/** The bit of the word at position `bit`, as 0 or 1. */
function bitOf(bit: number): number {
  return encoding.value ? (encoding.value.word >>> bit) & 1 : 0;
}
</script>

<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle class="group-data-[size=sm]/card:text-base">Machine code</CardTitle>
      <CardDescription v-if="shown">
        <span class="font-mono text-foreground">{{ formatInstruction(shown.instruction) }}</span>
        · {{ summary }}
      </CardDescription>
      <CardDescription v-else>
        Build an instruction or add one to the program to see the 32 bits it becomes.
      </CardDescription>
    </CardHeader>

    <CardContent v-if="shown && encoding" class="@container flex flex-col gap-3">
      <!-- The word bit by bit, 31 on the left as it is written, with each field over its bits. -->
      <!-- Never squeezed: in a short panel the body scrolls, and the strip keeps its height. -->
      <div class="shrink-0 overflow-x-auto">
        <div
          class="grid min-w-[30rem] grid-cols-[repeat(32,minmax(0,1fr))] gap-y-1 font-mono text-2xs"
          aria-label="The 32 bits of the instruction"
        >
          <span
            v-for="field in encoding.fields"
            :key="`${field.label}-${field.high}`"
            class="truncate rounded-t-sm border-x border-t px-0.5 text-center"
            :class="FIELD_COLOURS[field.name]"
            :style="{ gridColumn: `${32 - field.high} / span ${field.high - field.low + 1}` }"
            :title="field.note"
          >
            {{ field.label }}
          </span>
          <span
            v-for="bit in BITS"
            :key="bit"
            class="border-y py-0.5 text-center text-xs"
            :class="[
              bit % 4 === 0 ? 'border-r border-r-foreground/25' : '',
              bitOf(bit) ? 'font-semibold' : 'text-muted-foreground'
            ]"
            :style="{ gridRow: 2 }"
          >
            {{ bitOf(bit) }}
          </span>
          <span
            v-for="bit in BITS.filter((b) => b % 4 === 0 || b === 31)"
            :key="`n${bit}`"
            class="text-center text-muted-foreground"
            :style="{ gridRow: 3, gridColumn: `${32 - bit} / span 1` }"
          >
            {{ bit }}
          </span>
        </div>
      </div>
      <p class="font-mono text-sm">
        = 0x{{ formatHex32(encoding.word) }}
        <span class="font-sans text-xs text-muted-foreground">
          stored low byte first:
          {{
            encoding.bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ')
          }}
        </span>
      </p>

      <!-- Two columns only where the panel itself is wide: in the sidebar a field has the row. -->
      <ol class="grid gap-1.5 text-xs @md:grid-cols-2" aria-label="The fields of the instruction">
        <li
          v-for="field in encoding.fields"
          :key="`${field.label}-${field.high}`"
          class="rounded-md border px-3 py-2"
          :class="FIELD_COLOURS[field.name]"
        >
          <div class="flex flex-wrap items-baseline gap-x-2">
            <span class="font-mono font-semibold">{{ field.label }}</span>
            <span class="font-mono text-muted-foreground">
              bits {{ field.high === field.low ? field.high : `${field.high}–${field.low}` }} =
              {{ formatBits(field.value, field.high - field.low + 1) }}
            </span>
          </div>
          <p class="mt-0.5 text-muted-foreground">{{ field.note }}</p>
        </li>
      </ol>
      <p v-if="encoding.problem" class="text-xs text-destructive" role="alert">
        {{ encoding.problem }}
      </p>
    </CardContent>
  </Card>
</template>
