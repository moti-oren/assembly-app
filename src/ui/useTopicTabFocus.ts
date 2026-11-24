import { createGlobalState } from '@vueuse/core';

/** How long a pressed topic's request for the focus stands: a page is on show well within it. */
const STANDS_FOR_MS = 2000;

/**
 * Every page has an activity bar of its own, so the topic button that was pressed is gone with
 * the page it was on. The button says here that it was pressed, and the same button of the next
 * page's bar takes the focus back, so the keyboard stays on the topics.
 */
export const useTopicTabFocus = createGlobalState(() => {
  let askedAt: number | null = null;

  /** A topic was pressed: the page that comes next should put the focus on its own. */
  function keep(): void {
    askedAt = Date.now();
  }

  /**
   * Whether a topic just asked for the focus; asking uses the request up. A request no page took,
   * as on a phone, which has no activity bar, is not left for a page that comes much later.
   */
  function take(): boolean {
    const asked = pending();
    askedAt = null;
    return asked;
  }

  /** Whether a topic just asked for the focus, without using the request up. */
  function pending(): boolean {
    return askedAt !== null && Date.now() - askedAt < STANDS_FOR_MS;
  }

  return { keep, take, pending };
});
