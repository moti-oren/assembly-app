<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRightLeft, Ellipsis, MessageSquare, Search, Settings } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { isApple } from '@/ui/platform';
import { TOPIC_CHOICES, type TopicId } from '@/ui/topics';
import { useFeedback } from '@/ui/useFeedback';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useSettings } from '@/ui/useSettings';
import { useTopic } from '@/ui/useTopic';
import BottomSheet from './BottomSheet.vue';

defineProps<{
  /** Two letters on the chip beside the name: what is on show. */
  badge: string;
  /** What the one menu below a desktop holds, for a screen reader. */
  menuLabel: string;
}>();
defineEmits<{ commands: [] }>();
/** The one menu below a desktop, which the page can also open. */
const menuOpen = defineModel<boolean>('menuOpen', { default: false });

const mode = useLayoutMode();
/**
 * Below a desktop the bar has no room for every button beside the topics and the topic's own
 * switch: the commands become an icon, and the rest goes into one menu.
 */
const compact = computed(() => mode.value !== 'desktop');
const { topic } = useTopic();
const feedback = useFeedback();
const settings = useSettings();

/** The palette opens with Cmd+K on Apple keyboards, Ctrl+K elsewhere. */
const shortcut = isApple ? '⌘K' : 'Ctrl K';

function goTo(id: TopicId): void {
  menuOpen.value = false;
  topic.value = id;
}

function feedbackFromMenu(): void {
  menuOpen.value = false;
  feedback.open.value = true;
}

/** From the menu's sheet, which closes first: the settings are a dialog of their own. */
function settingsFromMenu(): void {
  menuOpen.value = false;
  settings.open.value = true;
}
</script>

<!--
  The bar every topic has: the mark and the name, and the commands; below a desktop also one menu
  with the topics, feedback and the settings, which a desktop has in its activity bar. A topic puts its own switch in `context`, its buttons in `actions`, and below a desktop the rows of
  its sheet: what it does in `menu-actions`, and what it lists under them in `menu`.
-->
<template>
  <!-- Part of the shell, where only the panes scroll. -->
  <header class="relative z-(--z-sticky) flex-none border-b bg-card">
    <!-- The last button is an icon with no edge of its own: more room on its side sets it in. -->
    <div class="flex h-12 items-center gap-3 pr-5 pl-4 max-sm:gap-2 max-sm:px-3">
      <!--
        The mark is the first thing in the bar at every width but the narrowest, where the opening
        animation lands. Below a desktop the name is for a screen reader only: a narrower bar would
        squeeze it away. The topics are the activity bar's, or the menu's below a desktop.
      -->
      <div class="flex min-w-0 items-center gap-2.5 max-lg:shrink-0">
        <div
          class="die-mark hidden shrink-0 min-[25rem]:grid"
          aria-hidden="true"
          data-splash-target
        >
          {{ badge }}
        </div>
        <h1 class="truncate text-sm font-semibold tracking-tight max-lg:sr-only">CPU Playground</h1>
      </div>
      <slot name="lead" />
      <slot name="context" />

      <div class="ml-auto flex items-center gap-1">
        <!-- Below a desktop it is an icon like the menu beside it: two buttons of one kind. -->
        <Button
          :variant="compact ? 'ghost' : 'outline'"
          :size="compact ? 'icon-sm' : 'sm'"
          class="mr-1 max-sm:mr-0 md:text-muted-foreground pointer-coarse:h-11 pointer-coarse:min-w-11"
          aria-label="Commands"
          aria-keyshortcuts="Control+K Meta+K"
          @click="$emit('commands')"
        >
          <Search />
          <template v-if="!compact">
            Commands
            <!-- A screen worked by touch has no keyboard to press it on. -->
            <Kbd class="touch:hidden">{{ shortcut }}</Kbd>
          </template>
        </Button>

        <slot v-if="!compact" name="actions" />

        <!--
          Below a desktop there is room for one menu: a sheet with the topics, the page's own
          actions, feedback and the settings, which a desktop has in its activity bar.
        -->
        <template v-else>
          <Button
            variant="ghost"
            size="icon-sm"
            class="pointer-coarse:size-11"
            :aria-label="menuLabel"
            aria-haspopup="dialog"
            :aria-expanded="menuOpen"
            data-feedback-opener
            data-share-opener
            data-settings-opener
            @click="menuOpen = true"
          >
            <Ellipsis aria-hidden="true" />
          </Button>
          <BottomSheet v-model:open="menuOpen" title="Menu" :description="menuLabel">
            <div>
              <!-- There is no activity bar below a desktop: the topics are here. -->
              <button
                v-for="choice in TOPIC_CHOICES.filter((each) => each.id !== topic)"
                :key="choice.id"
                type="button"
                class="sheet-row"
                @click="goTo(choice.id)"
              >
                <ArrowRightLeft aria-hidden="true" />
                Go to {{ choice.name }}
              </button>
              <slot name="menu-actions" />
              <button
                v-if="feedback.available"
                type="button"
                class="sheet-row"
                @click="feedbackFromMenu"
              >
                <MessageSquare aria-hidden="true" />
                Send feedback
              </button>
              <button type="button" class="sheet-row" @click="settingsFromMenu">
                <Settings aria-hidden="true" />
                Settings
              </button>
            </div>
            <slot name="menu" />
          </BottomSheet>
        </template>
      </div>
    </div>
  </header>
</template>
