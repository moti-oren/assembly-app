<script setup lang="ts">
import { computed } from 'vue';
import { formatInstruction, type Instruction } from '@/core/x86/instructions';
import { formatBits, formatBytes, formatHex } from '@/core/shared/numbers';
import type { Said } from '@/core/shared/text';
import type { AssembledLine } from '@/core/x86/encode';
import type { EncodingTextKey } from '@/core/x86/encodingTexts';
import type { EncodingShown } from '@/ui/encodingShown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/ui/useLocale';
import { whereText } from '@/ui/encodingShown';
import { withoutBits, withoutModBits } from '@/ui/x86EncodingView';

const { t } = useLocale();

const props = defineProps<{
  /** The instruction on show with its machine code, or null when there is nothing to encode. */
  shown: EncodingShown<Instruction, AssembledLine> | null;
}>();

/** What a field says, in the language of the interface. */
function say(said: Said<EncodingTextKey>): string {
  return t.value.x86Text.encoding(said.key, said.params);
}

const problemText = computed(() => {
  const said = props.shown?.assembled.encoding.problemSay;
  return said ? say(said) : null;
});

const summary = computed(() => {
  if (!props.shown) return null;
  const { bytes } = props.shown.assembled.encoding;
  return t.value.x86Encoding.summary(
    t.value.common.bytes(bytes.length),
    `${formatHex(props.shown.assembled.offset, 16)}h`,
    whereText(t.value, props.shown.where)
  );
});
</script>

<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle class="group-data-[size=sm]/card:text-base">{{ t.encoding.title }}</CardTitle>
      <CardDescription v-if="shown">
        <span class="font-mono text-foreground">{{ formatInstruction(shown.instruction) }}</span>
        · {{ summary }}
      </CardDescription>
      <CardDescription v-else>
        {{ t.encoding.x86Empty }}
      </CardDescription>
    </CardHeader>

    <CardContent v-if="shown" class="flex flex-col gap-2">
      <!-- One box per field, in the order the bytes sit in memory. -->
      <ol dir="ltr" class="flex flex-wrap items-stretch gap-2" :aria-label="t.encoding.fields">
        <li
          v-for="(field, index) in shown.assembled.encoding.fields"
          :key="index"
          class="max-w-full min-w-0 rounded-md border bg-inset px-2.5 py-1.5 sm:max-w-72"
        >
          <div class="flex items-baseline gap-2">
            <span class="font-mono text-sm font-semibold">{{ formatBytes(field.bytes) }}</span>
            <span class="text-2xs font-medium tracking-wide text-muted-foreground uppercase">{{
              t.x86Encoding.fields[field.kind]
            }}</span>
          </div>
          <dl
            v-if="field.modrm"
            class="mt-1 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-2 text-xs text-muted-foreground"
          >
            <dt>mod</dt>
            <dd class="font-mono text-foreground">{{ formatBits(field.modrm.mod, 2) }}</dd>
            <dd>{{ withoutModBits(say(field.modrm.modSay)) }}</dd>
            <dt>reg</dt>
            <dd class="font-mono text-foreground">{{ formatBits(field.modrm.reg, 3) }}</dd>
            <dd>{{ withoutBits(say(field.modrm.regSay)) }}</dd>
            <dt>r/m</dt>
            <dd class="font-mono text-foreground">{{ formatBits(field.modrm.rm, 3) }}</dd>
            <dd>{{ withoutBits(say(field.modrm.rmSay)) }}</dd>
          </dl>
          <p v-else class="ui-text mt-0.5 text-xs text-muted-foreground">{{ say(field.say) }}</p>
        </li>
      </ol>
      <p v-if="problemText" class="ui-text text-xs text-destructive" role="alert">
        {{ problemText }}
      </p>
    </CardContent>
  </Card>
</template>
