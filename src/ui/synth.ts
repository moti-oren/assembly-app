import type { SoundKind } from './sounds';

/**
 * Mechanical sounds synthesized with Web Audio: relays, switches and card punches rather than
 * beeps. Clicks are short bursts of filtered noise; weight comes from a sine that drops in pitch.
 */

interface Click {
  /** Centre of the band-pass filter: higher is a smaller, harder switch. */
  freq: number;
  q?: number;
  decay: number;
  gain: number;
}

interface Thump {
  from: number;
  to: number;
  decay: number;
  gain: number;
}

let audio: AudioContext | undefined;
let master: GainNode | undefined;
let noise: AudioBuffer | undefined;

function context(): { ctx: AudioContext; out: GainNode; noise: AudioBuffer } {
  if (!audio || !master || !noise) {
    audio = new AudioContext();
    master = audio.createGain();
    master.gain.value = 0.6;
    master.connect(audio.destination);
    noise = audio.createBuffer(1, Math.round(audio.sampleRate * 0.25), audio.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  // Browsers start the context suspended until a user gesture.
  if (audio.state === 'suspended') void audio.resume();
  return { ctx: audio, out: master, noise };
}

function envelope(ctx: AudioContext, at: number, peak: number, decay: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  return gain;
}

function click(at: number, { freq, q = 3, decay, gain }: Click): void {
  const { ctx, out, noise: buffer } = context();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  source
    .connect(filter)
    .connect(envelope(ctx, at, gain, decay))
    .connect(out);
  source.start(at);
  source.stop(at + decay + 0.01);
}

function thump(at: number, { from, to, decay, gain }: Thump): void {
  const { ctx, out } = context();
  const oscillator = ctx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + decay);
  oscillator.connect(envelope(ctx, at, gain, decay)).connect(out);
  oscillator.start(at);
  oscillator.stop(at + decay + 0.01);
}

/** A low, rough hum: something went wrong. */
function buzz(at: number, freq: number, decay: number, gain: number): void {
  const { ctx, out } = context();
  const oscillator = ctx.createOscillator();
  oscillator.type = 'square';
  oscillator.frequency.value = freq;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  oscillator
    .connect(filter)
    .connect(envelope(ctx, at, gain, decay))
    .connect(out);
  oscillator.start(at);
  oscillator.stop(at + decay + 0.01);
}

/** Two contacts closing one after the other, the second higher or lower. */
function relay(at: number, first: number, second: number): void {
  click(at, { freq: first, q: 4, decay: 0.02, gain: 0.45 });
  click(at + 0.045, { freq: second, q: 4, decay: 0.025, gain: 0.5 });
}

const RECIPES: Record<SoundKind, (at: number) => void> = {
  register: (at) => {
    click(at, { freq: 3500, q: 5, decay: 0.018, gain: 0.5 });
    click(at, { freq: 1700, q: 2, decay: 0.012, gain: 0.25 });
  },
  memory: (at) => {
    click(at, { freq: 1100, decay: 0.03, gain: 0.45 });
    thump(at, { from: 170, to: 90, decay: 0.07, gain: 0.35 });
  },
  push: (at) => {
    click(at, { freq: 1300, decay: 0.025, gain: 0.4 });
    thump(at, { from: 220, to: 120, decay: 0.08, gain: 0.35 });
  },
  pop: (at) => {
    click(at, { freq: 1300, decay: 0.025, gain: 0.4 });
    thump(at, { from: 120, to: 220, decay: 0.07, gain: 0.3 });
  },
  'jump-forward': (at) => relay(at, 2200, 3000),
  'jump-back': (at) => relay(at, 3000, 2000),
  'no-jump': (at) => click(at, { freq: 1600, q: 2, decay: 0.015, gain: 0.2 }),
  call: (at) => {
    relay(at, 1800, 2600);
    thump(at, { from: 140, to: 200, decay: 0.08, gain: 0.25 });
  },
  ret: (at) => {
    relay(at, 2600, 1800);
    thump(at, { from: 200, to: 140, decay: 0.08, gain: 0.25 });
  },
  flags: (at) => click(at, { freq: 5200, q: 8, decay: 0.012, gain: 0.3 }),
  idle: (at) => click(at, { freq: 900, q: 1, decay: 0.01, gain: 0.12 }),
  undo: (at) => {
    click(at, { freq: 1400, decay: 0.02, gain: 0.3 });
    click(at + 0.025, { freq: 900, decay: 0.02, gain: 0.2 });
  },
  ratchet: (at) => {
    for (let i = 0; i < 5; i++) {
      click(at + i * 0.022, { freq: 2600, q: 4, decay: 0.012, gain: 0.4 - i * 0.06 });
    }
  },
  error: (at) => {
    click(at, { freq: 600, q: 1, decay: 0.03, gain: 0.35 });
    buzz(at, 82, 0.16, 0.25);
  },
  punch: (at) => {
    click(at, { freq: 500, q: 1, decay: 0.05, gain: 0.45 });
    click(at, { freq: 4000, q: 4, decay: 0.01, gain: 0.3 });
  },
  halt: (at) => {
    click(at, { freq: 700, q: 2, decay: 0.04, gain: 0.35 });
    thump(at, { from: 140, to: 50, decay: 0.25, gain: 0.45 });
  },
  overflow: (at) => buzz(at, 55, 0.14, 0.3)
};

/** Plays a sound, optionally `delay` seconds from now so layered sounds don't blur together. */
export function playSound(kind: SoundKind, delay = 0): void {
  const { ctx } = context();
  RECIPES[kind](ctx.currentTime + delay);
}
