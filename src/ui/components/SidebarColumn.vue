<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { sectionStyle, type SidebarKey } from '@/ui/sidebarLayout';
import { useSidebarLayout } from '@/ui/useSidebarLayout';
import { useSidebarResize } from '@/ui/useSidebarResize';
import SidebarSection from './SidebarSection.vue';
import SortableColumn from './SortableColumn.vue';

/**
 * The sidebar: a column of panels the user can reorder, collapse to their headers and, on a
 * wide screen, resize, the open ones sharing the pane's height between them.
 */
const props = defineProps<{
  keys: SidebarKey[];
  labels: Record<SidebarKey, string>;
  closable: readonly SidebarKey[];
}>();

const emit = defineEmits<{
  move: [key: SidebarKey, to: number];
  close: [key: SidebarKey];
}>();

defineSlots<Record<SidebarKey, () => unknown>>();

// SortableColumn is generic, so its instance type is not inferred; only its element is used.
const column = useTemplateRef<{ $el: HTMLElement }>('column');
const layout = useSidebarLayout();
const resize = useSidebarResize(
  (key) =>
    column.value?.$el.querySelector(`[data-sortable="${key}"]`)?.getBoundingClientRect().height ?? 0
);

const open = computed(() => props.keys.filter((key) => !layout.isCollapsed(key)));

/** The panel above card `index`, when both are open, so the line between them can move. */
function above(index: number): SidebarKey | null {
  const key = props.keys[index - 1];
  if (key === undefined || layout.isCollapsed(key) || layout.isCollapsed(props.keys[index])) {
    return null;
  }
  return key;
}
</script>

<template>
  <SortableColumn
    ref="column"
    :keys="keys"
    :labels="labels"
    :item-style="(key) => sectionStyle(key, layout.isCollapsed(key), layout.sizeOf(key))"
    @move="(key, to) => emit('move', key, to)"
  >
    <template v-for="(key, index) in keys" :key="key" #[key]>
      <SidebarSection
        :label="labels[key]"
        :collapsed="layout.isCollapsed(key)"
        :closable="closable.includes(key)"
        :resizable="above(index) !== null"
        @toggle="layout.toggle(key)"
        @close="emit('close', key)"
        @resize-start="resize.start($event, open, above(index)!, key)"
        @resize-key="resize.onKey($event, open, above(index)!, key)"
      >
        <slot :name="key" />
      </SidebarSection>
    </template>
  </SortableColumn>
</template>
