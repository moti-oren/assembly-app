import type { CpuMoment } from './cpuMoment';
import type { PaletteCommand } from './paletteCommand';

/** What the palette asks of the page of a topic that follows a CPU. */
export interface TopicPageActions {
  seek: (position: number) => void;
  back: () => void;
}

/** The palette commands every topic that follows a CPU offers: the way back, and the steps. */
export function momentCommands(
  { cpu, previous, next }: CpuMoment<unknown>,
  page: TopicPageActions
): PaletteCommand[] {
  return [
    {
      group: 'CPU',
      label: `Go back to the ${cpu}`,
      // The CPU's page takes focus; the palette must not take it back as it closes.
      moves: 'focus',
      run: page.back
    },
    {
      group: 'CPU',
      label: 'Show the operation before this one',
      disabled: previous === null,
      run: () => previous !== null && page.seek(previous)
    },
    {
      group: 'CPU',
      label: 'Show the operation after this one',
      disabled: next === null,
      run: () => next !== null && page.seek(next)
    }
  ];
}
