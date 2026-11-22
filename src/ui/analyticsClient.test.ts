import { describe, expect, it, vi } from 'vitest';
import { createAnalytics, type Tracker } from './analyticsClient';

/** A loader the test finishes by hand, and the tracker it hands over. */
function setup({ websiteId }: { websiteId?: string } = { websiteId: 'site' }) {
  const track = vi.fn();
  let finish: (tracker: Tracker | null) => void = () => {};
  const load = vi.fn(
    () =>
      new Promise<Tracker | null>((resolve) => {
        finish = resolve;
      })
  );
  const analytics = createAnalytics({ websiteId, load });
  const loaded = async (tracker: Tracker | null = { track }): Promise<void> => {
    finish(tracker);
    await Promise.resolve();
  };
  return { analytics, track, load, loaded };
}

describe('createAnalytics', () => {
  it('loads nothing and sends nothing until it is enabled', () => {
    const { analytics, track, load } = setup();
    analytics.track({ name: 'compare-opened' });
    expect(load).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('never loads without a site', () => {
    const { analytics, load } = setup({});
    analytics.setEnabled(true);
    analytics.track({ name: 'compare-opened' });
    expect(load).not.toHaveBeenCalled();
  });

  it('sends what waited once the script has loaded, in order', async () => {
    const { analytics, track, load, loaded } = setup();
    analytics.setEnabled(true);
    analytics.track({ name: 'view', topic: 'cpu', architecture: 'x86' });
    analytics.track({ name: 'compare-opened' });
    expect(load).toHaveBeenCalledWith('site');
    expect(track).not.toHaveBeenCalled();
    await loaded();
    expect(track.mock.calls).toEqual([
      ['view', { topic: 'cpu', architecture: 'x86' }],
      ['compare-opened', {}]
    ]);
    analytics.track({ name: 'first-step', architecture: 'rv32' });
    expect(track).toHaveBeenLastCalledWith('first-step', { architecture: 'rv32' });
  });

  it('drops what waited when turned off before the script loaded', async () => {
    const { analytics, track, loaded } = setup();
    analytics.setEnabled(true);
    analytics.track({ name: 'compare-opened' });
    analytics.setEnabled(false);
    await loaded();
    expect(track).not.toHaveBeenCalled();
  });

  it('stops sending when turned off, and loads the script once', async () => {
    const { analytics, track, load, loaded } = setup();
    analytics.setEnabled(true);
    await loaded();
    analytics.setEnabled(false);
    analytics.track({ name: 'compare-opened' });
    expect(track).not.toHaveBeenCalled();
    analytics.setEnabled(true);
    analytics.track({ name: 'compare-opened' });
    expect(track).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the script could not be loaded', async () => {
    const { analytics, track, loaded } = setup();
    analytics.setEnabled(true);
    analytics.track({ name: 'compare-opened' });
    await loaded(null);
    analytics.track({ name: 'compare-opened' });
    expect(track).not.toHaveBeenCalled();
  });
});
