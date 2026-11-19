import { computed } from 'vue';
import { createGlobalState, useLocalStorage } from '@vueuse/core';
import {
  defaultLayout,
  isDefaultLayout,
  readLayout,
  type SidebarKey,
  type SidebarLayout
} from './sidebarLayout';
import { STORAGE_KEYS } from './storageKeys';

/**
 * Which sidebar panels are collapsed and how tall the open ones are, remembered between visits
 * and shared by every architecture, since their sidebars hold the same panels.
 */
export const useSidebarLayout = createGlobalState(() => {
  const layout = useLocalStorage<SidebarLayout>(STORAGE_KEYS.sidebarLayout, defaultLayout(), {
    serializer: { read: readLayout, write: (value) => JSON.stringify(value) }
  });

  const isDefault = computed(() => isDefaultLayout(layout.value));

  function isCollapsed(key: SidebarKey): boolean {
    return layout.value.collapsed.includes(key);
  }

  function setCollapsed(key: SidebarKey, collapsed: boolean): void {
    const others = layout.value.collapsed.filter((item) => item !== key);
    layout.value = { ...layout.value, collapsed: collapsed ? [...others, key] : others };
  }

  function toggle(key: SidebarKey): void {
    setCollapsed(key, !isCollapsed(key));
  }

  function expand(key: SidebarKey): void {
    if (isCollapsed(key)) setCollapsed(key, false);
  }

  function sizeOf(key: SidebarKey): number {
    return layout.value.sizes[key];
  }

  function setSizes(sizes: Partial<Record<SidebarKey, number>>): void {
    layout.value = { ...layout.value, sizes: { ...layout.value.sizes, ...sizes } };
  }

  function reset(): void {
    layout.value = defaultLayout();
  }

  return { isDefault, isCollapsed, toggle, expand, sizeOf, setSizes, reset };
});
