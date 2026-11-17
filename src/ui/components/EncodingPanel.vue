<script setup lang="ts">
import { computed } from 'vue';
import type { FieldKind } from '@/core/encode';
import { formatInstruction } from '@/core/instructions';
import { formatBits, formatBytes, formatHex } from '@/core/numbers';
import type { EncodingShown } from '@/ui/encodingShown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const props = defineProps<{
  /** The instruction on show with its machine code, or null when there is nothing to encode. */
  shown: EncodingShown | null;
}>();

const KIND_LABELS: Record<FieldKind, string> = {
  prefix: 'Prefix',
  opcode: 'Opcode',
  modrm: 'ModR/M',
  displacement: 'Displacement',
  immediate: 'Immediate',
  relative: 'Distance'
};

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
          class="max-w-full min-w-0 rounded-md border bg-muted/30 px-2.5 py-1.5 sm:max-w-72"
        >
          <div class="flex items-baseline gap-2">
            <span class="font-mono text-sm font-semibold">{{ formatBytes(field.bytes) }}</span>
            <span class="text-2xs font-medium tracking-wide text-pointer uppercase">{{
              KIND_LABELS[field.kind]
            }}</span>
          </div>
          <dl
            v-if="field.modrm"
            class="mt-1 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-2 text-xs text-muted-foreground"
          >
            <dt>mod</dt>
            <dd class="font-mono text-foreground">{{ formatBits(field.modrm.mod, 2) }}</dd>
            <dd>{{ field.modrm.modNote.replace(/^[01]+(:| with)\s*/, '') }}</dd>
            <dt>reg</dt>
            <dd class="font-mono text-foreground">{{ formatBits(field.modrm.reg, 3) }}</dd>
            <dd>{{ field.modrm.regNote.replace(/^[01]+ = /, '') }}</dd>
            <dt>r/m</dt>
            <dd class="font-mono text-foreground">{{ formatBits(field.modrm.rm, 3) }}</dd>
            <dd>{{ field.modrm.rmNote.replace(/^[01]+ = /, '') }}</dd>
          </dl>
          <p v-else class="mt-0.5 text-xs text-muted-foreground">{{ field.note }}</p>
        </li>
      </ol>
      <p v-if="shown.assembled.encoding.problem" class="text-xs text-destructive" role="alert">
        {{ shown.assembled.encoding.problem }}
      </p>
    </CardContent>
  </Card>
</template>
