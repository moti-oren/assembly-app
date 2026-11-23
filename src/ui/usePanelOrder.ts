import { computed, watch, type Ref } from 'vue';
import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { moveAmongVisible, sanitizeOrder } from './reorder';
import { isSidebarKey, SIDEBAR_PANELS, type SidebarKey } from './sidebarLayout';
import { STAGE, type StageKey } from './stagePanels';
import { STORAGE_KEYS } from './storageKeys';
import type { Panels } from './usePanels';
import { usePreferences } from './usePreferences';
import { useSidebarLayout } from './useSidebarLayout';

export type PanelKey = SidebarKey | StageKey;

export const PANEL_LABELS: Record<PanelKey, string> = {
  challenge: 'Challenge',
  builder: 'Instruction',
  program: 'Program',
  history: 'History',
  encoding: 'Machine code',
  cpu: 'CPU',
  cycle: 'Cycle',
  registers: 'Registers',
  operation: 'Last operation',
  flags: 'Flags',
  stack: 'Stack',
  devices: 'I/O devices',
  memory: 'Memory'
};

interface Orders {
  /** The sidebar, top to bottom. The key keeps its old name, so a saved order still loads. */
  left: SidebarKey[];
}

function defaults(): Orders {
  return { left: [...SIDEBAR_PANELS] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Anything unreadable in storage falls back to the defaults; saved stage orders are ignored. */
function read(raw: string): Orders {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const stored: Record<string, unknown> = isRecord(parsed) ? parsed : {};
  const left = sanitizeOrder(stored.left, SIDEBAR_PANELS);
  // An order saved before there were challenges gets their panel on top, not at the end.
  const placed = Array.isArray(stored.left) && stored.left.includes('challenge');
  return { left: placed ? left : ['challenge', ...left.filter((key) => key !== 'challenge')] };
}

/** The order the user dragged the sidebar's panels into, remembered between visits. */
export const usePanelOrder = createGlobalState(() => {
  const orders = useLocalStorage<Orders>(STORAGE_KEYS.panelOrder, defaults(), {
    serializer: { read, write: (value) => JSON.stringify(value) }
  });

  const isDefault = computed(() => orders.value.left.join() === SIDEBAR_PANELS.join());

  function setOrder(order: SidebarKey[]): void {
    orders.value = { left: order };
  }

  function reset(): void {
    orders.value = defaults();
  }

  return { orders, isDefault, setOrder, reset };
});

/**
 * The panels each column shows, in their order, leaving out the ones that are hidden, and how
 * to move one of the sidebar's. The stage follows the CPU view.
 */
export function usePanelColumns(panels: Panels) {
  const { orders, setOrder } = usePanelOrder();
  const { cpuView } = usePreferences();
  const sidebar = useSidebarLayout();

  /** The panels that can be hidden, and whether each one is on show now. */
  const shown: Partial<Record<PanelKey, Ref<boolean>>> = {
    challenge: panels.challengeShown,
    history: panels.historyShown,
    encoding: panels.bytesShown,
    devices: panels.devicesShown,
    stack: panels.stackShown
  };
  const closable = SIDEBAR_PANELS.filter((key) => shown[key] !== undefined);

  // A sidebar panel asked for again opens up, even if it was collapsed when it was closed.
  for (const key of closable) {
    watch(shown[key]!, (on) => {
      if (on) sidebar.expand(key);
    });
  }

  function onShow<K extends PanelKey>(keys: readonly K[]): K[] {
    return keys.filter((key) => shown[key]?.value !== false);
  }

  const leftKeys = computed(() => onShow(orders.value.left).filter(isSidebarKey));

  /** Makes `key` visible panel number `to`; hidden panels keep their places. */
  function move(key: SidebarKey, to: number): void {
    setOrder(moveAmongVisible(orders.value.left, leftKeys.value, key, to));
  }

  function close(key: SidebarKey): void {
    const panel = shown[key];
    if (panel) panel.value = false;
  }

  return {
    leftKeys,
    rightKeys: computed(() => onShow<StageKey>(STAGE[cpuView.value])),
    /** The sidebar panels that can be closed, not only collapsed. */
    closable,
    move,
    close
  };
}
