<script setup lang="ts">
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { isApple } from '@/ui/platform';
import { shortcutList } from '@/ui/shortcutList';

const shortcuts = shortcutList(isApple);
</script>

<!-- The shortcuts, to read: none of them can be changed. -->
<template>
  <dl>
    <div
      v-for="shortcut in shortcuts"
      :key="shortcut.label"
      class="flex items-center justify-between gap-4 border-t py-3 first:border-t-0"
    >
      <dt class="min-w-0 text-sm">
        {{ shortcut.label }}
        <span v-if="shortcut.where" class="block text-xs text-muted-foreground">
          {{ shortcut.where }}
        </span>
      </dt>
      <dd class="shrink-0">
        <KbdGroup>
          <Kbd v-for="key in shortcut.keys" :key="key">{{ key }}</Kbd>
        </KbdGroup>
      </dd>
    </div>
  </dl>
</template>
