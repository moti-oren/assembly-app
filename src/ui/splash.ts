/** Removes the splash should its fade never end (a hidden tab runs no transitions). */
const FADE_FALLBACK_MS = 1000;

/**
 * Takes the opening animation of index.html away once the app has mounted: after its last part
 * has played (at once when motion is reduced, as nothing plays), it fades out and is removed.
 * The fade itself is splash.css's transition.
 */
export function dismissSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const playing = splash.querySelector('.splash-label')?.getAnimations() ?? [];
  if (playing.length === 0) {
    splash.remove();
    return;
  }
  void Promise.allSettled(playing.map((animation) => animation.finished)).then(() => {
    const remove = (): void => splash.remove();
    splash.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, FADE_FALLBACK_MS);
    splash.classList.add('splash-out');
  });
}
