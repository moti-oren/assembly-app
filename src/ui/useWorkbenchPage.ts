import { useTemplateRef } from 'vue';
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
}

/**
 * The page actions that reach into a workbench's builder and memory panel, which its template
 * marks with `ref="builder"` and `ref="memoryView"`.
 */
export function useWorkbenchPage(hasLastAccess: () => boolean): WorkbenchPage {
  const builder = useTemplateRef<BuilderHandle>('builder');
  const memoryView = useTemplateRef<MemoryHandle>('memoryView');
  return {
    focusBuilder: () => builder.value?.focus(),
    foldBuilder: () => builder.value?.fold(),
    clearBuilder: () => builder.value?.clear(),
    showStackTop: () => memoryView.value?.showStackTop(),
    showLastAccess: () => memoryView.value?.showLastAccess(),
    hasLastAccess
  };
}
