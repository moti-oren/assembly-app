<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/x86/execute';
import { explainFlag } from '@/core/x86/flagReasons';
import type { FlagName } from '@/core/x86/flags';
import { formatInstruction } from '@/core/x86/instructions';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const props = defineProps<{
  flag: FlagName;
  /** The last executed instruction: the one whose effect on the flag is explained. */
  record: ExecutionRecord | null;
}>();

const reason = computed(() => props.record && explainFlag(props.record, props.flag));
</script>

<template>
  <!-- The body of a flag's tooltip: what the flag means, then why it is 0 or 1 right now. -->
  <div class="flex flex-col gap-1.5 py-0.5 text-start">
    <p>
      <span class="font-semibold">{{ t.x86Text.flagLabel(flag) }}.</span>
      {{ t.x86Text.flagDescription(flag) }}
    </p>
    <p v-if="record && reason" class="border-t border-background/25 pt-1.5">
      <span class="font-mono font-semibold">
        {{ formatInstruction(record.instruction) }} →
        {{ reason.value === null ? t.flags.unchanged(flag) : `${flag} = ${reason.value ? 1 : 0}` }}
      </span>
      <br />
      {{ reason.text }}
    </p>
  </div>
</template>
