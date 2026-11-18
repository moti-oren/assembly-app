/** Delay between two program lines while running; `instant` runs to the end in one go. */
export const RUN_SPEEDS = { slow: 1100, normal: 600, fast: 150, instant: 0 } as const;
export type RunSpeed = keyof typeof RUN_SPEEDS;

export const RUN_SPEED_NAMES = Object.keys(RUN_SPEEDS) as RunSpeed[];

export function isRunSpeed(value: unknown): value is RunSpeed {
  return typeof value === 'string' && value in RUN_SPEEDS;
}

export const SPEED_LABELS: Record<RunSpeed, string> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
  instant: 'Instant'
};
