/**
 * How the workbench is laid out for the width of the window. A desktop has the two panes side by
 * side; a tablet gives the stage the whole width and slides the sidebar over it; a phone shows
 * one view at a time.
 */
export type LayoutMode = 'phone' | 'tablet' | 'desktop';

/** Tailwind's `md` and `lg` breakpoints, in rem, which the style sheets switch at too. */
const TABLET_FROM_REM = 48;
const DESKTOP_FROM_REM = 64;

export const TABLET_QUERY = `(width >= ${TABLET_FROM_REM}rem)`;
export const DESKTOP_QUERY = `(width >= ${DESKTOP_FROM_REM}rem)`;

/** The mode for a window `width` pixels wide, with the root font at `rem` pixels. */
export function modeForWidth(width: number, rem = 16): LayoutMode {
  if (width >= DESKTOP_FROM_REM * rem) return 'desktop';
  return width >= TABLET_FROM_REM * rem ? 'tablet' : 'phone';
}

export function modeFor(tablet: boolean, desktop: boolean): LayoutMode {
  if (desktop) return 'desktop';
  return tablet ? 'tablet' : 'phone';
}

/** The views a phone switches between, in the order of their tabs. */
export const PHONE_VIEWS = ['code', 'cpu', 'memory'] as const;

export type PhoneView = (typeof PHONE_VIEWS)[number];

export const PHONE_VIEW_LABELS: Record<PhoneView, string> = {
  code: 'Code',
  cpu: 'CPU',
  memory: 'Memory & I/O'
};
