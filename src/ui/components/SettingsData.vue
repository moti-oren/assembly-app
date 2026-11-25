<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { clearStoredData } from '@/ui/storedData';
import { usePanelOrder } from '@/ui/usePanelOrder';
import { useSidebarLayout } from '@/ui/useSidebarLayout';
import SettingsRow from './SettingsRow.vue';

const panelOrder = usePanelOrder();
const sidebar = useSidebarLayout();
const layoutIsDefault = computed(() => panelOrder.isDefault.value && sidebar.isDefault.value);
const clearAsked = ref(false);

function resetLayout(): void {
  panelOrder.reset();
  sidebar.reset();
}

/** The page starts again from nothing: what is in memory would be written back otherwise. */
function clearEverything(): void {
  clearStoredData(localStorage);
  location.reload();
}
</script>

<template>
  <!-- The button says what it does, so it keeps its own name, not the row's. -->
  <SettingsRow
    v-slot="{ named }"
    label="Panel layout"
    :description="
      layoutIsDefault
        ? 'The sidebar\'s panels are in their first order and sizes.'
        : 'Puts the sidebar\'s panels back in their first order and sizes.'
    "
  >
    <Button
      variant="outline"
      size="sm"
      class="pointer-coarse:h-11"
      :disabled="layoutIsDefault"
      :aria-describedby="named['aria-describedby']"
      @click="resetLayout"
    >
      Reset the layout
    </Button>
  </SettingsRow>
  <SettingsRow
    label="Saved programs and settings"
    description="This browser keeps the program of each CPU, these settings and the layout. Nothing is kept anywhere else."
  >
    <Button
      variant="outline"
      size="sm"
      class="pointer-coarse:h-11"
      aria-haspopup="dialog"
      @click="clearAsked = true"
    >
      Clear everything…
    </Button>
  </SettingsRow>

  <AlertDialog v-model:open="clearAsked">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Clear everything saved?</AlertDialogTitle>
        <AlertDialogDescription>
          The program of every CPU, the settings and the panel layout are removed from this browser,
          and the page starts again as on a first visit. This can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep everything</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="clearEverything">
          Clear everything
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
