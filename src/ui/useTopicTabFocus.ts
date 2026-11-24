import { createGlobalState } from '@vueuse/core';

/** How long a pressed tab's request for the focus stands: a page is on show well within it. */
const STANDS_FOR_MS = 2000;

/**
 * Every page has a header of its own, so the topic tab that was pressed is gone with the page it
 * was on. The tab says here that it was pressed, and the same tab of the next page's header
 * takes the focus back, so the keyboard stays on the tabs.
 */
export const useTopicTabFocus = createGlobalState(() => {
  let askedAt: number | null = null;

  /** A tab was pressed: the page that comes next should put the focus on its own. */
  function keep(): void {
    askedAt = Date.now();
  }

  /**
   * Whether a tab just asked for the focus; asking uses the request up. A request no page took,
   * as on a phone, whose header has no tabs, is not left for a page that comes much later.
   */
  function take(): boolean {
    const asked = askedAt;
    askedAt = null;
    return asked !== null && Date.now() - asked < STANDS_FOR_MS;
  }

  return { keep, take };
});
