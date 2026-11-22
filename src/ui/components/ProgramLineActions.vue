<script setup lang="ts">
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

defineProps<{
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

const ALT = isApple ? '⌥' : 'Alt';

type FocusAction = 'edit' | 'moveUp' | 'moveDown';

/**
 * Editing and moving send the focus somewhere: to the builder, or along with the moved line.
 * The menu takes the focus back to its button as it closes, which would undo that, so these
 * wait for the menu to close and then run in place of its own focus move.
 */
let pending: FocusAction | null = null;

function afterClose(action: FocusAction): void {
  pending = action;
}

function onCloseAutoFocus(event: Event): void {
  const action = pending;
  pending = null;
  if (!action) return;
  event.preventDefault();
  if (action === 'edit') emit('edit');
  else if (action === 'moveUp') emit('moveUp');
  else emit('moveDown');
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
    <DropdownMenu>
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
        <DropdownMenuItem class="pointer-coarse:py-2.5" @select="afterClose('edit')">
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          class="pointer-coarse:py-2.5"
          :disabled="!canMoveUp"
          @select="afterClose('moveUp')"
        >
          <ArrowUp />
          Move up
          <DropdownMenuShortcut class="touch:hidden">{{ ALT }} ↑</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="pointer-coarse:py-2.5"
          :disabled="!canMoveDown"
          @select="afterClose('moveDown')"
        >
          <ArrowDown />
          Move down
          <DropdownMenuShortcut class="touch:hidden">{{ ALT }} ↓</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem class="pointer-coarse:py-2.5" @select="emit('insertAbove')">
          <ArrowUpToLine />
          Insert new lines above
        </DropdownMenuItem>
        <!-- Always here: the bytes beside the line are not drawn where they do not fit. -->
        <DropdownMenuItem
          class="pointer-coarse:py-2.5"
          :disabled="!canInspect"
          @select="emit('inspect')"
        >
          <Binary />
          Inspect machine code
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          class="pointer-coarse:py-2.5"
          @select="emit('remove')"
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
