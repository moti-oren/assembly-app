/** How long the fade out takes, with room to spare; splash.css has the transition itself. */
const FADE_MS = 400;

/**
 * Takes the opening animation of index.html away once the app has mounted: after its last part
 * has played (at once when motion is reduced, as nothing plays), it fades out and is removed.
 */
export function dismissSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const label = splash.querySelector('.splash-label');
  const playing = label?.getAnimations?.() ?? [];
  if (playing.length === 0) {
    splash.remove();
    return;
  }
  void Promise.allSettled(playing.map((animation) => animation.finished)).then(() => {
    splash.classList.add('splash-out');
    setTimeout(() => splash.remove(), FADE_MS);
  });
}
