import { useTemplateRef } from 'vue';
import type { MemoryPlace } from './flatMemory';
import type { WorkbenchPage } from './useWorkbench';

/** What the instruction builder exposes to the page. */
interface BuilderHandle {
  focus: () => void;
  fold: () => void;
  clear: () => void;
}

/** What a memory panel exposes to the page. */
interface MemoryHandle {
  showStackTop: () => void;
  showLastAccess: () => void;
  /** Jumps to one of the places the panel was given, by its label. */
  showPlace?: (label: string) => void;
}

/**
 * The page actions that reach into a workbench's builder and memory panel, which its template
 * marks with `ref="builder"` and `ref="memoryView"`. `places` are the memory panel's places to jump
 * to, when it has any besides the stack.
 */
export function useWorkbenchPage(
  hasLastAccess: () => boolean,
  places: readonly MemoryPlace[] = []
): WorkbenchPage {
  const labels = places.filter((place) => !place.stack).map((place) => place.label);
  const builder = useTemplateRef<BuilderHandle>('builder');
  const memoryView = useTemplateRef<MemoryHandle>('memoryView');
  return {
    focusBuilder: () => builder.value?.focus(),
    foldBuilder: () => builder.value?.fold(),
    clearBuilder: () => builder.value?.clear(),
    showStackTop: () => memoryView.value?.showStackTop(),
    showLastAccess: () => memoryView.value?.showLastAccess(),
    memoryPlaces: () => labels,
    showMemoryPlace: (label) => memoryView.value?.showPlace?.(label),
    hasLastAccess
  };
}
