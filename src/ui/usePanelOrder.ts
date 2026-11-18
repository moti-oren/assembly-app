import { computed } from 'vue';
import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { moveAmongVisible, sanitizeOrder } from './reorder';
import type { Panels } from './usePanels';
import { usePreferences } from './usePreferences';

/**
 * The cards of each column, in their default order. The right column has one order per CPU
 * view, since the diagram and the tables show different cards.
 */
const DEFAULTS = {
  left: ['builder', 'program', 'history', 'encoding'],
  diagram: ['cycle', 'cpu', 'devices', 'memory'],
  table: ['cycle', 'registers', 'operation', 'flags', 'devices', 'memory']
} as const;

export type Column = keyof typeof DEFAULTS;
export type PanelKey = (typeof DEFAULTS)[Column][number];
type Orders = { [C in Column]: PanelKey[] };

export const PANEL_LABELS: Record<PanelKey, string> = {
  builder: 'Instruction',
  program: 'Program',
  history: 'History',
  encoding: 'Machine code',
  cpu: 'CPU',
  cycle: 'Cycle',
  registers: 'Registers',
  operation: 'Last operation',
  flags: 'Flags',
  devices: 'I/O devices',
  memory: 'Memory'
};

const COLUMNS = Object.keys(DEFAULTS) as Column[];

function defaults(): Orders {
  return { left: [...DEFAULTS.left], diagram: [...DEFAULTS.diagram], table: [...DEFAULTS.table] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Anything unreadable in storage falls back to the defaults, column by column. */
function read(raw: string): Orders {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const stored: Record<string, unknown> = isRecord(parsed) ? parsed : {};
  return {
    left: sanitizeOrder(stored.left, DEFAULTS.left),
    diagram: sanitizeOrder(stored.diagram, DEFAULTS.diagram),
    table: sanitizeOrder(stored.table, DEFAULTS.table)
  };
}

/** The order the user dragged the cards into, remembered between visits. */
export const usePanelOrder = createGlobalState(() => {
  const orders = useLocalStorage<Orders>('8086-panel-order', defaults(), {
    serializer: { read, write: (value) => JSON.stringify(value) }
  });

  const isDefault = computed(() =>
    COLUMNS.every((column) => orders.value[column].join() === DEFAULTS[column].join())
  );

  function setOrder(column: Column, order: PanelKey[]): void {
    orders.value = { ...orders.value, [column]: order };
  }

  function reset(): void {
    orders.value = defaults();
  }

  return { orders, isDefault, setOrder, reset };
});

/**
 * The cards each column shows, in their order, leaving out the ones that are hidden, and how to
 * move one of them. The right column follows the CPU view, which has an order of its own.
 */
export function usePanelColumns(panels: Panels) {
  const { orders, setOrder } = usePanelOrder();
  const { cpuView } = usePreferences();
  const rightColumn = computed<Column>(() => cpuView.value);

  /** The cards that can be hidden, and whether each one is hidden now. */
  const hidden = computed<Partial<Record<PanelKey, boolean>>>(() => ({
    history: !panels.historyShown.value,
    encoding: !panels.bytesShown.value,
    devices: !panels.devicesShown.value
  }));

  function visible(column: Column): PanelKey[] {
    return orders.value[column].filter((key) => !hidden.value[key]);
  }

  /** Makes `key` visible card number `to`; hidden cards keep their places. */
  function move(column: Column, key: PanelKey, to: number): void {
    setOrder(column, moveAmongVisible(orders.value[column], visible(column), key, to));
  }

  return {
    leftKeys: computed(() => visible('left')),
    rightKeys: computed(() => visible(rightColumn.value)),
    rightColumn,
    move
  };
}
