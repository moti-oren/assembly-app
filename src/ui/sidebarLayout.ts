/** The panels of the sidebar, in their default order. */
export const SIDEBAR_PANELS = ['challenge', 'builder', 'program', 'history', 'encoding'] as const;

export type SidebarKey = (typeof SIDEBAR_PANELS)[number];

/**
 * What closing a panel does, where it is more than hiding it: the challenge's panel is on show
 * only while there is a challenge, so closing it leaves the challenge.
 */
export const CLOSE_LABELS: Partial<Record<SidebarKey, string>> = {
  challenge: 'Leave the challenge'
};

/**
 * How the sidebar's panels share its height: which are collapsed to their header, and how tall
 * each open one would like to be. Sizes are weights: the open panels share the pane in
 * proportion to them, so the layout follows the window's height. No panel grows past its
 * content, so the room a short one leaves goes to the others.
 */
export interface SidebarLayout {
  collapsed: SidebarKey[];
  sizes: Record<SidebarKey, number>;
}

const DEFAULT_SIZES: Record<SidebarKey, number> = {
  challenge: 380,
  builder: 320,
  program: 360,
  history: 240,
  encoding: 240
};

/**
 * The least an open panel can be dragged down to: its header and a few rows, and for the
 * builder its input, a row of its choices and its buttons, which are of no use cut off.
 */
const MIN_HEIGHTS: Record<SidebarKey, number> = {
  challenge: 132,
  builder: 296,
  program: 96,
  history: 96,
  encoding: 96
};

/**
 * A program line's height; how many of them stay in sight whatever else is open, and the room
 * kept for a few even before there are any, where the lines being written will go.
 */
const PROGRAM_ROW = 28;
const PROGRAM_ROWS_KEPT = 6;
const PROGRAM_ROWS_ROOM = 4;

/**
 * The least an open panel is given. The program keeps a few of its lines in sight, as many as
 * it has up to a handful and room for four even when it has fewer (a challenge starts with one
 * or two), so opening every panel does not leave it a couple of rows.
 */
export function leastHeight(key: SidebarKey, programRows = 0): number {
  if (key !== 'program') return MIN_HEIGHTS[key];
  const rows = Math.min(Math.max(programRows, PROGRAM_ROWS_ROOM), PROGRAM_ROWS_KEPT);
  return MIN_HEIGHTS.program + rows * PROGRAM_ROW;
}

export function isSidebarKey(key: string): key is SidebarKey {
  return (SIDEBAR_PANELS as readonly string[]).includes(key);
}

export function defaultLayout(): SidebarLayout {
  return { collapsed: [], sizes: { ...DEFAULT_SIZES } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Anything unreadable in storage falls back to the defaults: unknown panels, bad sizes. */
export function readLayout(raw: string): SidebarLayout {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const stored = isRecord(parsed) ? parsed : {};
  const collapsed = Array.isArray(stored.collapsed)
    ? stored.collapsed.filter(
        (key): key is SidebarKey => typeof key === 'string' && isSidebarKey(key)
      )
    : [];
  const sizes = { ...DEFAULT_SIZES };
  if (isRecord(stored.sizes)) {
    for (const [key, size] of Object.entries(stored.sizes)) {
      if (isSidebarKey(key) && typeof size === 'number' && Number.isFinite(size) && size > 0) {
        sizes[key] = size;
      }
    }
  }
  return { collapsed: [...new Set(collapsed)], sizes };
}

export function isDefaultLayout(layout: SidebarLayout): boolean {
  return (
    layout.collapsed.length === 0 &&
    SIDEBAR_PANELS.every((key) => layout.sizes[key] === DEFAULT_SIZES[key])
  );
}

/**
 * Where one panel sits in the pane, as CSS variables. The style sheet applies them only on a
 * wide screen, where the sidebar has a height of its own to share.
 */
export function sectionStyle(
  key: SidebarKey,
  collapsed: boolean,
  size: number,
  programRows = 0
): Record<string, string> {
  if (collapsed) return { '--section-flex': '0 0 auto', '--section-min': 'auto' };
  return {
    '--section-flex': `${size} 1 0px`,
    '--section-min': `${leastHeight(key, programRows)}px`,
    '--section-max': 'max-content'
  };
}

/**
 * Moves the line between two neighbouring open panels by `dy` pixels. Their total stays the
 * same, and neither goes below the least height the page gives it (the program's counts its
 * lines); two panels already that small do not move.
 */
export function resizePair(
  above: { key: SidebarKey; height: number },
  below: { key: SidebarKey; height: number },
  dy: number,
  programRows = 0
): [number, number] {
  const total = above.height + below.height;
  const least = leastHeight(above.key, programRows);
  const most = total - leastHeight(below.key, programRows);
  if (most < least) return [above.height, below.height];
  const next = Math.min(Math.max(above.height + dy, least), most);
  return [next, total - next];
}
