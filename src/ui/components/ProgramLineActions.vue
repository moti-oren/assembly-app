<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import { ArrowDown, ArrowUp, ArrowUpToLine, Binary, Ellipsis, Pencil, X } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isApple } from '@/ui/platform';
import { useLayoutMode } from '@/ui/useLayoutMode';
import BottomSheet from './BottomSheet.vue';

const props = defineProps<{
  /** The line as the program names it: `L3`. */
  label: string;
  /** Whether there is a line above, and one below, to move past. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Whether the line has machine code to take apart. */
  canInspect: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  moveUp: [];
  moveDown: [];
  insertAbove: [];
  inspect: [];
  remove: [];
}>();

const mode = useLayoutMode();
/** A phone's sheet of the same actions, in place of the menu. */
const sheetOpen = ref(false);

const ALT = isApple ? '⌥' : 'Alt';

type Action = 'edit' | 'moveUp' | 'moveDown' | 'insertAbove' | 'inspect' | 'remove';

interface Item {
  action: Action;
  label: string;
  icon: Component;
  disabled?: boolean;
  shortcut?: string;
}

const items = computed<Item[]>(() => [
  { action: 'edit', label: 'Edit', icon: Pencil },
  {
    action: 'moveUp',
    label: 'Move up',
    icon: ArrowUp,
    disabled: !props.canMoveUp,
    shortcut: `${ALT} ↑`
  },
  {
    action: 'moveDown',
    label: 'Move down',
    icon: ArrowDown,
    disabled: !props.canMoveDown,
    shortcut: `${ALT} ↓`
  },
  { action: 'insertAbove', label: 'Insert new lines above', icon: ArrowUpToLine },
  // Always here: the bytes beside the line are not drawn where they do not fit.
  {
    action: 'inspect',
    label: 'Inspect machine code',
    icon: Binary,
    disabled: !props.canInspect
  }
]);

function run(action: Action): void {
  if (action === 'edit') emit('edit');
  else if (action === 'moveUp') emit('moveUp');
  else if (action === 'moveDown') emit('moveDown');
  else if (action === 'insertAbove') emit('insertAbove');
  else if (action === 'inspect') emit('inspect');
  else emit('remove');
}

/**
 * Editing and moving send the focus somewhere: to the builder, or along with the moved line.
 * The menu takes the focus back to its button as it closes, which would undo that, so these
 * wait for the menu or the sheet to close and then run in place of its own focus move.
 */
const MOVES_FOCUS: ReadonlySet<Action> = new Set(['edit', 'moveUp', 'moveDown']);
let pending: Action | null = null;

function choose(action: Action): void {
  sheetOpen.value = false;
  if (MOVES_FOCUS.has(action)) pending = action;
  else run(action);
}

function onCloseAutoFocus(event: Event): void {
  const action = pending;
  pending = null;
  if (!action) return;
  event.preventDefault();
  run(action);
}
</script>

<!--
  What can be done to one program line. With a mouse, editing and deleting are a click away and
  the rest is in the menu; a touch screen has room for the menu alone, which holds everything.
-->
<template>
  <span
    class="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-data-[state=open]:opacity-100 pointer-coarse:opacity-100"
  >
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-xs"
          class="pointer-coarse:hidden"
          data-action="edit"
          :aria-label="`Edit ${label}`"
          @click="emit('edit')"
        >
          <Pencil />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Edit this line</TooltipContent>
    </Tooltip>
    <!-- On a phone the same actions rise in a sheet, clear of the bar at the foot. -->
    <template v-if="mode === 'phone'">
      <Button
        variant="ghost"
        size="icon-xs"
        class="pointer-coarse:size-11"
        data-action="more"
        :aria-label="`More for ${label}: move, insert, inspect, delete`"
        aria-haspopup="dialog"
        :aria-expanded="sheetOpen"
        @click="sheetOpen = true"
      >
        <Ellipsis />
      </Button>
      <BottomSheet
        v-model:open="sheetOpen"
        :title="`Line ${label}`"
        description="Edit, move, insert above, inspect or delete this line."
        @close-auto-focus="onCloseAutoFocus"
      >
        <div>
          <button
            v-for="item in items"
            :key="item.action"
            type="button"
            class="sheet-row"
            :disabled="item.disabled"
            @click="choose(item.action)"
          >
            <component :is="item.icon" aria-hidden="true" />
            {{ item.label }}
          </button>
        </div>
        <div class="border-t pt-2">
          <button type="button" class="sheet-row text-destructive" @click="choose('remove')">
            <X class="text-destructive!" aria-hidden="true" />
            Delete
          </button>
        </div>
      </BottomSheet>
    </template>
    <DropdownMenu v-else>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-xs"
          class="pointer-coarse:size-11"
          data-action="more"
          :aria-label="`More for ${label}: move, insert, inspect, delete`"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="min-w-52" @close-auto-focus="onCloseAutoFocus">
        <DropdownMenuItem
          v-for="item in items"
          :key="item.action"
          class="pointer-coarse:py-2.5"
          :disabled="item.disabled"
          @select="choose(item.action)"
        >
          <component :is="item.icon" />
          {{ item.label }}
          <DropdownMenuShortcut v-if="item.shortcut" class="touch:hidden">{{
            item.shortcut
          }}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          class="pointer-coarse:py-2.5"
          @select="choose('remove')"
        >
          <X />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-xs"
          class="hover:text-destructive pointer-coarse:hidden"
          data-action="remove"
          :aria-label="`Delete ${label}`"
          @click="emit('remove')"
        >
          <X />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Delete this line</TooltipContent>
    </Tooltip>
  </span>
</template>
