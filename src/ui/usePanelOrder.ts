import { computed } from 'vue';
import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { sanitizeOrder } from './reorder';

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

/** Anything unreadable in storage falls back to the defaults, column by column. */
function read(raw: string): Orders {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const stored = (parsed ?? {}) as Partial<Record<Column, unknown>>;
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
