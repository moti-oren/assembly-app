<script setup lang="ts">
import type { AluLink } from '@/core/aluLink';
import type { NumberLink } from '@/core/numberLink';
import type { RegisterLink } from '@/core/registerLink';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { unavailableIn } from '@/ui/topicLinks';
import CpuViewToggle from './CpuViewToggle.vue';
import OperationLinks from './OperationLinks.vue';
import TopicLinkButton from './TopicLinkButton.vue';

defineProps<{
  /**
   * Where the last instruction leads in the other topics. The diagram has no panel of its own
   * for the operation or the registers, so the ways in sit in its header; absent, none is shown.
   */
  alu?: AluLink | null;
  numbers?: NumberLink | null;
  stored?: RegisterLink | null;
}>();
</script>

<!-- The CPU panel of every architecture: its header, and the sheet the diagram is drawn on. -->
<template>
  <Card>
    <CardHeader class="items-center">
      <CardTitle class="self-center">CPU</CardTitle>
      <CardAction
        class="flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground"
      >
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-pointer" aria-hidden="true" />
          read
        </span>
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-written" aria-hidden="true" />
          written
        </span>
        <div class="flex items-center gap-1.5 max-sm:hidden">
          <OperationLinks v-if="alu && numbers" :alu="alu" :numbers="numbers" />
          <TopicLinkButton v-if="stored" topic="storage" :unavailable="unavailableIn(stored)" />
        </div>
        <!-- Switches an architecture adds for its own diagram. -->
        <slot name="actions" />
        <CpuViewToggle />
      </CardAction>
      <!-- A phone has no room beside the title: the ways into the topics take a row under it. -->
      <div
        v-if="(alu && numbers) || stored"
        class="col-span-2 flex flex-wrap items-center gap-1.5 pt-1 sm:hidden"
      >
        <OperationLinks v-if="alu && numbers" :alu="alu" :numbers="numbers" />
        <TopicLinkButton v-if="stored" topic="storage" :unavailable="unavailableIn(stored)" />
      </div>
    </CardHeader>
    <CardContent>
      <slot />
    </CardContent>
  </Card>
</template>
