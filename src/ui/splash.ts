/** When the chip is complete (splash.css) and may move into the header. */
const CHIP_READY_MS = 1900;
const MORPH_MS = 520;
const FALLBACK_MS = 220;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Ends the splash should its animations never finish (a hidden tab runs none). */
const STUCK_MS = 1500;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The move and scale that lay box `from` over box `to`, both scaled from their centres. */
export function morphBetween(from: Box, to: Box): { x: number; y: number; scale: number } {
  return {
    x: to.left + to.width / 2 - (from.left + from.width / 2),
    y: to.top + to.height / 2 - (from.top + from.height / 2),
    scale: to.width / from.width
  };
}

/** Whether a box can be landed on: a hidden element measures 0 by 0. */
export function isLandable(box: Box): boolean {
  return box.width > 0 && box.height > 0;
}

/**
 * How long until the chip is complete, counted from when its lid began to appear. An animation
 * that has not started yet has no start time: it starts with the next frame, so the whole build
 * is still to come. That is the case whenever the style sheet arrives with the app itself, as it
 * does from the dev server.
 */
export function untilReady(started: CSSNumberish | null, now: CSSNumberish | null): number {
  if (typeof started !== 'number' || typeof now !== 'number') return CHIP_READY_MS;
  return Math.max(0, CHIP_READY_MS - (now - started));
}

const animate = (
  element: Element | null,
  frames: Keyframe[],
  options: KeyframeAnimationOptions
): Animation | null => element?.animate(frames, { fill: 'forwards', ...options }) ?? null;

/**
 * A copy of the header's mark over the real one. It is animated through a frame of its own: an
 * animated element is a stacking context, which would draw the mark's pins (z-index -1) over its
 * own lid, while inside the frame they sit behind it as they do in the header.
 */
function twinOf(target: HTMLElement, at: DOMRect): HTMLElement {
  const frame = document.createElement('div');
  Object.assign(frame.style, {
    position: 'absolute',
    left: `${at.left}px`,
    top: `${at.top}px`,
    width: `${at.width}px`,
    height: `${at.height}px`
  });
  const twin = target.cloneNode(true) as HTMLElement;
  twin.removeAttribute('data-splash-target');
  twin.style.margin = '0';
  frame.append(twin);
  return frame;
}

/**
 * The chip shrinks and slides into the header's mark. A copy of the mark rides along the same
 * path the other way, from the chip's size down to its own, and covers the chip as it goes: it
 * lands as the real mark's exact twin, so the swap at the end cannot shift a pixel.
 */
function morph(splash: HTMLElement, chip: HTMLElement, target: HTMLElement): Animation[] {
  const to = target.getBoundingClientRect();
  const { x, y, scale } = morphBetween(chip.getBoundingClientRect(), to);
  const twin = twinOf(target, to);
  splash.append(twin);
  target.style.opacity = '0';

  const move = { duration: MORPH_MS, easing: EASE };
  return [
    animate(splash.querySelector('.splash-backdrop'), [{ opacity: 0 }], move),
    animate(chip, [{ transform: `translate(${x}px, ${y}px) scale(${scale})` }], move),
    animate(
      twin,
      [{ transform: `translate(${-x}px, ${-y}px) scale(${1 / scale})` }, { transform: 'none' }],
      move
    ),
    // The twin's lid hides the chip's as soon as it is opaque; only the labels cross-fade.
    animate(twin, [{ opacity: 0 }, { opacity: 0, offset: 0.15 }, { opacity: 1, offset: 0.5 }], {
      duration: MORPH_MS
    }),
    animate(
      chip,
      [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }],
      {
        duration: MORPH_MS
      }
    )
  ].filter((animation) => animation !== null);
}

/** With nothing to land on (a phone hides the header's mark), the chip only fades. */
function fade(splash: HTMLElement, chip: HTMLElement): Animation[] {
  const options = { duration: FALLBACK_MS, easing: EASE };
  return [
    animate(chip, [{ transform: 'scale(0.96)', opacity: 0 }], options),
    animate(splash, [{ opacity: 0 }], options)
  ].filter((animation) => animation !== null);
}

/**
 * Ends the opening animation of index.html once the app has mounted: when the chip is complete
 * it moves into the header's mark (or fades, with no mark to land on), and is removed. A skipped
 * splash (splash.css hides it) is removed at once.
 */
export function dismissSplash(): void {
  const splash = document.getElementById('splash');
  const chip = splash?.querySelector<HTMLElement>('.splash-chip');
  if (!splash || !chip || splash.getClientRects().length === 0) {
    splash?.remove();
    return;
  }
  const leave = (): void => {
    const target = document.querySelector<HTMLElement>('[data-splash-target]');
    const landable = target !== null && isLandable(target.getBoundingClientRect());
    const playing = landable ? morph(splash, chip, target) : fade(splash, chip);
    const finish = (): void => {
      if (target) target.style.opacity = '';
      splash.remove();
    };
    void Promise.allSettled(playing.map((animation) => animation.finished)).then(finish);
    setTimeout(finish, STUCK_MS);
  };
  // Counted once the lid's animation has really started, which may be a long frame away. A hidden
  // tab starts it when shown; a cancelled one (its ready rejected) still lets the splash leave.
  const lid = splash.querySelector('.splash-lid')?.getAnimations()[0];
  const schedule = (): void => {
    setTimeout(leave, untilReady(lid?.startTime ?? null, document.timeline.currentTime));
  };
  void (lid?.ready ?? Promise.resolve()).then(schedule, schedule);
}
