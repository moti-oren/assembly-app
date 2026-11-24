<script setup lang="ts">
import { ChevronRight, X } from '@lucide/vue';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * One panel of the sidebar, VS Code style: its header folds it away and opens it again (and
 * drags it, see SortableColumn.vue), a closable one has a close button, and the line above it
 * can be dragged to resize it. The arrow button is the panel's handle for moving it by keyboard,
 * unless the panel is `fixed` in its place.
 */
const props = defineProps<{
  label: string;
  collapsed: boolean;
  closable: boolean;
  /** Whether the line above it moves: only between two open panels. */
  resizable: boolean;
  /** A panel that keeps its place in the column: its header only folds it. */
  fixed?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  close: [];
  resizeStart: [event: PointerEvent];
  resizeKey: [event: KeyboardEvent];
}>();

/** A click anywhere on the panel's header folds it, except on a control of its own. */
function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!target.closest('[data-slot="card-header"]')) return;
  if (target.closest('button, a, input, select, [role="button"]')) return;
  emit('toggle');
}
</script>

<template>
  <div
    class="sidebar-section"
    :data-state="props.collapsed ? 'collapsed' : 'open'"
    @click="onClick"
  >
    <div
      v-if="resizable"
      class="sidebar-sash"
      role="separator"
      aria-orientation="horizontal"
      tabindex="0"
      :aria-label="`Resize the ${label} panel`"
      title="Drag to resize"
      @pointerdown="emit('resizeStart', $event)"
      @keydown="emit('resizeKey', $event)"
    />
    <button
      type="button"
      class="sidebar-toggle"
      :data-sortable-handle="fixed ? undefined : ''"
      :aria-keyshortcuts="fixed ? undefined : 'Alt+ArrowUp Alt+ArrowDown'"
      :title="fixed ? undefined : 'Alt+Up or Alt+Down moves the panel; so does dragging its header'"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? `Expand the ${label} panel` : `Collapse the ${label} panel`"
      @click.stop="emit('toggle')"
    >
      <ChevronRight aria-hidden="true" />
    </button>
    <Tooltip v-if="closable">
      <TooltipTrigger as-child>
        <button
          type="button"
          class="sidebar-close"
          :aria-label="`Close the ${label} panel`"
          @click.stop="emit('close')"
        >
          <X aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Close {{ label }}</TooltipContent>
    </Tooltip>
    <slot />
  </div>
</template>
