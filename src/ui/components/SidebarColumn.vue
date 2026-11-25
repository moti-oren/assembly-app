<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { CLOSE_LABELS, sectionStyle, type SidebarKey } from '@/ui/sidebarLayout';
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
  /** How many lines the program has: its panel keeps a few of them in sight. */
  programRows?: number;
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
    column.value?.$el.querySelector(`[data-sortable="${key}"]`)?.getBoundingClientRect().height ??
    0,
  // The line stops where the panel drawn does: the program keeps room for its lines.
  () => props.programRows ?? 0
);

const open = computed(() => props.keys.filter((key) => !layout.isCollapsed(key)));

/**
 * Closes a panel. Its buttons go with it, so the focus goes to the header of the panel that took
 * its place, or of the one above when it was the last: never to the page behind.
 */
function close(key: SidebarKey): void {
  const index = props.keys.indexOf(key);
  emit('close', key);
  void nextTick(() => {
    const toggles = column.value?.$el.querySelectorAll<HTMLElement>('.sidebar-toggle') ?? [];
    toggles[Math.min(index, toggles.length - 1)]?.focus();
  });
}

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
    role="region"
    aria-label="The program and the instruction builder"
    :keys="keys"
    :labels="labels"
    :item-style="
      (key) => sectionStyle(key, layout.isCollapsed(key), layout.sizeOf(key), programRows)
    "
    @move="(key, to) => emit('move', key, to)"
  >
    <template v-for="(key, index) in keys" :key="key" #[key]>
      <SidebarSection
        :label="labels[key]"
        :collapsed="layout.isCollapsed(key)"
        :closable="closable.includes(key)"
        :close-label="CLOSE_LABELS[key]"
        :resizable="above(index) !== null"
        @toggle="layout.toggle(key)"
        @close="close(key)"
        @resize-start="resize.start($event, open, above(index)!, key)"
        @resize-key="resize.onKey($event, open, above(index)!, key)"
      >
        <slot :name="key" />
      </SidebarSection>
    </template>
  </SortableColumn>
</template>
