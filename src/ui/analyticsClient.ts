import type { AnalyticsEvent } from './analyticsEvents';

/** What the analytics service's script gives the page once it has loaded. */
export interface Tracker {
  track: (name: string, data?: Record<string, string>) => void;
}

export interface AnalyticsConfig {
  /** Which site the events belong to; without one nothing is ever loaded or sent. */
  websiteId: string | undefined;
  /** Loads the service's script. Null when it could not be loaded, as behind a blocker. */
  load: (websiteId: string) => Promise<Tracker | null>;
}

/** Events kept while the script loads; a visit that makes more than this before then loses them. */
const QUEUE_LIMIT = 50;

/**
 * Counts what the app is used for. Nothing is loaded until it is enabled, and turning it off
 * stops every event at once, the ones still waiting included.
 */
export function createAnalytics(config: AnalyticsConfig) {
  let enabled = false;
  let tracker: Tracker | null = null;
  let loading = false;
  let queue: AnalyticsEvent[] = [];

  function send(event: AnalyticsEvent): void {
    const { name, ...data } = event;
    tracker?.track(name, data);
  }

  function load(websiteId: string): void {
    if (loading) return;
    loading = true;
    void config.load(websiteId).then((loaded) => {
      tracker = loaded;
      // Turned off while it loaded: what waited is dropped, not sent late.
      const waiting = enabled ? queue : [];
      queue = [];
      waiting.forEach(send);
    });
  }

  function setEnabled(value: boolean): void {
    enabled = value;
    if (!value) queue = [];
    else if (config.websiteId) load(config.websiteId);
  }

  function track(event: AnalyticsEvent): void {
    if (!enabled || !config.websiteId) return;
    if (tracker) send(event);
    else if (queue.length < QUEUE_LIMIT) queue.push(event);
  }

  return { setEnabled, track };
}

declare global {
  interface Window {
    umami?: Tracker;
  }
}

/** Umami Cloud's tracker, as the site's "tracking code" gives it; another host is set at build time. */
const SCRIPT_URL: string =
  import.meta.env.VITE_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js';

/** Adds Umami's script to the page. It sets no cookie and sends the visit's page view itself. */
function loadUmami(websiteId: string): Promise<Tracker | null> {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.defer = true;
    script.src = SCRIPT_URL;
    script.dataset.websiteId = websiteId;
    script.dataset.doNotTrack = 'true';
    // The address holds nothing of the user's, and it stays that way.
    script.dataset.excludeSearch = 'true';
    script.dataset.excludeHash = 'true';
    // A copy of the site served from anywhere else (a fork, a preview) is not counted.
    const domains = import.meta.env.VITE_UMAMI_DOMAINS;
    if (domains) script.dataset.domains = domains;
    script.onload = () => resolve(window.umami ?? null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

/** The app's analytics: off in development, and in any build that names no site. */
export const analytics = createAnalytics({
  websiteId: import.meta.env.PROD ? import.meta.env.VITE_UMAMI_WEBSITE_ID || undefined : undefined,
  load: loadUmami
});
