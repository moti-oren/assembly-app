import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The least of Web Audio the engine touches, counting what it makes and unhooks. */
class FakeNode {
  static started: FakeNode[] = [];
  static disconnected = 0;
  onended: (() => void) | null = null;
  type = '';
  buffer: unknown = null;
  gain = param();
  frequency = param();
  Q = param();
  threshold = param();
  knee = param();
  ratio = param();
  attack = param();
  release = param();
  connect<T>(next: T): T {
    return next;
  }
  disconnect(): void {
    FakeNode.disconnected++;
  }
  start(): void {
    FakeNode.started.push(this);
  }
  stop(): void {}
}

function param() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn()
  };
}

class FakeContext {
  static made = 0;
  static last: FakeContext;
  state: 'running' | 'suspended' = 'running';
  currentTime = 0;
  sampleRate = 100;
  destination = new FakeNode();
  constructor() {
    FakeContext.made++;
    FakeContext.last = this;
  }
  createGain = () => new FakeNode();
  createBiquadFilter = () => new FakeNode();
  createDynamicsCompressor = () => new FakeNode();
  createOscillator = () => new FakeNode();
  createBufferSource = () => new FakeNode();
  createBuffer = () => ({ getChannelData: () => new Float32Array(50) });
  suspend = vi.fn(async () => void (this.state = 'suspended'));
  resume = vi.fn(async () => void (this.state = 'running'));
}

const page = { hidden: false, listeners: new Map<string, () => void>() };

/** A fresh engine, on a page the user has already pressed something on unless told otherwise. */
async function loadEngine(touched = true) {
  vi.resetModules();
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: () => void) => page.listeners.set(type, listener)
  });
  vi.stubGlobal('document', {
    get hidden() {
      return page.hidden;
    },
    addEventListener: (type: string, listener: () => void) => page.listeners.set(type, listener)
  });
  const { sound } = await import('./soundEngine');
  if (touched) {
    sound.setEnabled(false);
    page.listeners.get('pointerdown')!();
  }
  return sound;
}

let clock = 0;

beforeEach(() => {
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  FakeNode.started = [];
  FakeNode.disconnected = 0;
  FakeContext.made = 0;
  page.hidden = false;
  page.listeners.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the sound engine', () => {
  it('is silent, and makes no audio context, while sound is off', async () => {
    const sound = await loadEngine();
    sound.setEnabled(false);
    sound.play('register');
    expect(FakeContext.made).toBe(0);
  });

  it('waits for the user to touch the page before making the context', async () => {
    const sound = await loadEngine(false);
    sound.setEnabled(true);
    sound.play('register');
    expect(FakeContext.made).toBe(0);

    page.listeners.get('pointerdown')!();
    sound.play('register');
    expect(FakeContext.made).toBe(1);
    expect(FakeNode.started).toHaveLength(2);
  });

  it('drops a sound repeated inside its cooldown, and plays it again after', async () => {
    const sound = await loadEngine();
    sound.setEnabled(true);
    sound.play('flags');
    sound.play('flags');
    expect(FakeNode.started).toHaveLength(1);

    clock += 50;
    sound.play('flags');
    expect(FakeNode.started).toHaveLength(2);
  });

  it('never sounds more than six voices at once', async () => {
    const sound = await loadEngine();
    sound.setEnabled(true);
    for (const name of ['register', 'memory', 'push', 'pop', 'call', 'ret'] as const) {
      sound.play(name);
    }
    expect(FakeNode.started).toHaveLength(6);

    // Voices that have ended on the audio clock free their place.
    FakeContext.last.currentTime = 1;
    sound.play('halt');
    expect(FakeNode.started).toHaveLength(8);
  });

  it('unhooks a finished voice from the graph', async () => {
    const sound = await loadEngine();
    sound.setEnabled(true);
    sound.play('register');
    for (const node of FakeNode.started) node.onended?.();
    // Each voice is a source and its envelope, and the noise has a filter too.
    expect(FakeNode.disconnected).toBe(5);
  });

  it('plays nothing in a hidden tab, and stops the audio clock there', async () => {
    const sound = await loadEngine();
    sound.setEnabled(true);
    sound.play('register');
    page.hidden = true;
    page.listeners.get('visibilitychange')!();
    sound.play('memory');
    expect(FakeNode.started).toHaveLength(2);

    page.hidden = false;
    page.listeners.get('visibilitychange')!();
    sound.play('memory');
    expect(FakeNode.started).toHaveLength(4);
  });

  it('never lets an audio failure reach the caller', async () => {
    const sound = await loadEngine();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no audio device');
        }
      }
    );
    sound.setEnabled(true);
    expect(() => sound.play('register')).not.toThrow();
  });
});
