<script setup lang="ts">
import { computed } from 'vue';
import type { FieldKind } from '@/core/x86/encodingFields';
import { formatInstruction, type Instruction } from '@/core/x86/instructions';
import { formatBits, formatBytes, formatHex } from '@/core/shared/numbers';
import type { AssembledLine } from '@/core/x86/encode';
import type { EncodingShown } from '@/ui/encodingShown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const props = defineProps<{
  /** The instruction on show with its machine code, or null when there is nothing to encode. */
  shown: EncodingShown<Instruction, AssembledLine> | null;
}>();

const KIND_LABELS: Record<FieldKind, string> = {
  prefix: 'Prefix',
  opcode: 'Opcode',
  modrm: 'ModR/M',
  displacement: 'Displacement',
  immediate: 'Immediate',
  relative: 'Distance'
};

/** Each kind of field in its own colour, as in the RISC-V panel. */
const KIND_TINTS: Record<FieldKind, string> = {
  prefix: 'bg-foreground/10',
  opcode: 'bg-chart-1/25',
  modrm: 'bg-chart-3/25',
  displacement: 'bg-chart-2/25',
  immediate: 'bg-chart-4/25',
  relative: 'bg-chart-5/25'
};

type ModRm = NonNullable<AssembledLine['encoding']['fields'][number]['modrm']>;

/** The three fields of a ModR/M byte, high bits first, with what each one selects. */
function modrmParts(modrm: ModRm): { name: string; bits: string; note: string; tint: string }[] {
  return [
    {
      name: 'mod',
      bits: formatBits(modrm.mod, 2),
      note: modrm.modNote.replace(/^[01]+(:| with)\s*/, ''),
      tint: 'bg-chart-3/30'
    },
    {
      name: 'reg',
      bits: formatBits(modrm.reg, 3),
      note: modrm.regNote.replace(/^[01]+ = /, ''),
      tint: 'bg-chart-2/30'
    },
    {
      name: 'r/m',
      bits: formatBits(modrm.rm, 3),
      note: modrm.rmNote.replace(/^[01]+ = /, ''),
      tint: 'bg-chart-4/30'
    }
  ];
}

const summary = computed(() => {
  if (!props.shown) return null;
  const { bytes } = props.shown.assembled.encoding;
  const count = `${bytes.length} byte${bytes.length === 1 ? '' : 's'}`;
  return `${count} at offset ${formatHex(props.shown.assembled.offset, 16)}h, ${props.shown.where}`;
});
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
        Build an instruction or add one to the program to see the bytes it assembles to.
      </CardDescription>
    </CardHeader>

    <CardContent v-if="shown" class="flex flex-col gap-2">
      <!-- One box per field, in the order the bytes sit in memory. -->
      <ol class="flex flex-wrap items-stretch gap-2" aria-label="The fields of the instruction">
        <li
          v-for="(field, index) in shown.assembled.encoding.fields"
          :key="index"
          class="well max-w-full min-w-0 rounded-md px-2.5 py-2 sm:max-w-72"
        >
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm font-semibold">{{ formatBytes(field.bytes) }}</span>
            <span
              class="rounded-sm px-1.5 py-px text-2xs font-medium tracking-wide uppercase"
              :class="KIND_TINTS[field.kind]"
              >{{ KIND_LABELS[field.kind] }}</span
            >
          </div>
          <template v-if="field.modrm">
            <!-- The byte drawn as its bits, each field as wide as the bits it takes. -->
            <div
              class="mt-2 grid w-40 max-w-full grid-cols-[2fr_3fr_3fr] gap-0.5 font-mono text-xs"
              aria-hidden="true"
            >
              <span
                v-for="part in modrmParts(field.modrm)"
                :key="part.name"
                class="rounded-sm py-0.5 pl-[0.25em] text-center font-semibold tracking-[0.25em]"
                :class="part.tint"
                >{{ part.bits }}</span
              >
            </div>
            <dl
              class="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground"
            >
              <template v-for="part in modrmParts(field.modrm)" :key="part.name">
                <dt>
                  <span class="rounded-sm px-1 font-mono text-foreground" :class="part.tint">{{
                    part.name
                  }}</span>
                </dt>
                <dd>
                  <span class="sr-only">{{ part.bits }}</span>
                  {{ part.note }}
                </dd>
              </template>
            </dl>
          </template>
          <p v-else class="mt-1 text-xs text-muted-foreground">{{ field.note }}</p>
        </li>
      </ol>
      <p v-if="shown.assembled.encoding.problem" class="text-xs text-destructive" role="alert">
        {{ shown.assembled.encoding.problem }}
      </p>
    </CardContent>
  </Card>
</template>
