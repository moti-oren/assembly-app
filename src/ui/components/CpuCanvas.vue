<script setup lang="ts">
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CpuViewToggle from './CpuViewToggle.vue';
</script>

<!-- The CPU panel of every architecture: its header, and the sheet the diagram is drawn on. -->
<template>
  <Card class="gap-0 pt-5 pb-0 short:pt-2 max-sm:pt-3">
    <CardHeader class="pb-3 short:pb-2 max-sm:pb-2 max-md:pb-1.5">
      <CardTitle>CPU</CardTitle>
      <CardAction class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-pointer" aria-hidden="true" />
          read
        </span>
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-written" aria-hidden="true" />
          written
        </span>
        <!-- Switches an architecture adds for its own diagram. -->
        <slot name="actions" />
        <CpuViewToggle />
      </CardAction>
    </CardHeader>
    <!-- On a phone the chip's own edge is line enough under the header. -->
    <CardContent
      class="border-t pt-6 pb-5 short:pt-3 short:pb-2 max-sm:py-3 max-md:border-t-0 max-md:pt-0 max-md:pb-4"
    >
      <slot />
    </CardContent>
  </Card>
</template>
