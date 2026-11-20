import { SOUNDS, type Sound, type SoundName, type Voice } from './soundPalette';

/**
 * Plays the palette through Web Audio. Everything is synthesized, so nothing is loaded; the
 * audio context is only made once the user has touched the page, as browsers require.
 */

/** Interface sound is felt more than heard: the whole mix sits well below full scale. */
const MASTER_GAIN = 0.22;
/** Voices sounding at once; a sound that would go over is cut short rather than piled on. */
const MAX_VOICES = 6;
/** Seconds before the same sound may play again, unless the sound sets its own. */
const DEFAULT_COOLDOWN = 0.04;
/** How far pitch and level drift from one play to the next, so repeats never sound stamped. */
const VARIATION = 0.02;
const NOISE_SECONDS = 0.5;

interface Rig {
  ctx: AudioContext;
  /** Where every voice goes: the start of the master chain. */
  input: AudioNode;
  noise: AudioBuffer;
}

export interface PlayOptions {
  /** Seconds from now, so layered sounds don't blur together. */
  delay?: number;
  /** Scales the sound's own level. */
  gain?: number;
}

let enabled = false;
let listening = false;
/** Browsers refuse audio until the user has pressed something. */
let gestured = false;
let rig: Rig | null = null;
/**
 * When each voice still sounding, or yet to sound, ends on the audio clock. Counted from the
 * clock rather than from `ended` events, so a missed event can never use a place up for good.
 */
let voiceEnds: number[] = [];
const lastPlayed = new Map<SoundName, number>();

const ignore = (): void => {};

function createRig(): Rig | null {
  if (typeof AudioContext === 'undefined') return null;
  const ctx = new AudioContext();
  const input = ctx.createGain();
  input.gain.value = MASTER_GAIN;
  // Rolls the top off every sound, then holds overlapping ones under the ceiling.
  const soften = ctx.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 7000;
  soften.Q.value = 0.5;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -18;
  limiter.knee.value = 12;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  input.connect(soften).connect(limiter).connect(ctx.destination);

  const noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return { ctx, input, noise };
}

/** The running audio rig, made on first need; null while sound cannot play. */
function wake(): Rig | null {
  if (!enabled || !gestured || document.hidden) return null;
  rig ??= createRig();
  if (rig?.ctx.state === 'suspended') rig.ctx.resume().catch(ignore);
  return rig;
}

function sleep(): void {
  if (rig?.ctx.state === 'running') rig.ctx.suspend().catch(ignore);
}

function onGesture(): void {
  gestured = true;
  safely(wake);
}

function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () =>
    safely(() => (document.hidden ? sleep() : wake()))
  );
}

/** Sound is decoration: whatever goes wrong in it must never reach the code that asked. */
function safely(action: () => void): void {
  try {
    action();
  } catch {
    // Silence is the right failure for a sound.
  }
}

function vary(): number {
  return 1 + (Math.random() * 2 - 1) * VARIATION;
}

/** Starts one voice and returns when it ends on the audio clock. */
function startVoice(target: Rig, voice: Voice, at: number, pitch: number, level: number): number {
  const { ctx } = target;
  const start = at + (voice.at ?? 0);
  const peak = start + voice.attack;
  const end = peak + voice.decay;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(voice.gain * level, peak);
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);

  const nodes: AudioNode[] = [envelope];
  let source: AudioScheduledSourceNode;
  if (voice.kind === 'noise') {
    const burst = ctx.createBufferSource();
    burst.buffer = target.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = voice.freq * pitch;
    filter.Q.value = voice.q;
    burst.connect(filter).connect(envelope);
    // A different stretch of the noise each time.
    burst.start(start, Math.random() * (NOISE_SECONDS / 2));
    nodes.push(burst, filter);
    source = burst;
  } else {
    const oscillator = ctx.createOscillator();
    oscillator.type = voice.wave;
    oscillator.frequency.setValueAtTime(voice.from * pitch, start);
    if (voice.to) oscillator.frequency.exponentialRampToValueAtTime(voice.to * pitch, end);
    oscillator.connect(envelope);
    oscillator.start(start);
    nodes.push(oscillator);
    source = oscillator;
  }
  envelope.connect(target.input);

  // Finished voices are unhooked, so a long run leaves nothing behind in the graph.
  source.onended = () => {
    for (const node of nodes) node.disconnect();
  };
  source.stop(end + 0.01);
  return end;
}

function play(name: SoundName, { delay = 0, gain = 1 }: PlayOptions = {}): void {
  safely(() => {
    const target = wake();
    if (!target) return;
    const sound: Sound = SOUNDS[name];
    const due = performance.now() / 1000 + delay;
    const last = lastPlayed.get(name);
    if (last !== undefined && due - last < (sound.cooldown ?? DEFAULT_COOLDOWN)) return;
    lastPlayed.set(name, due);

    const now = target.ctx.currentTime;
    const at = now + delay;
    voiceEnds = voiceEnds.filter((end) => end > now);
    const pitch = vary();
    const level = gain * vary();
    for (const voice of sound.voices) {
      if (voiceEnds.length >= MAX_VOICES) break;
      voiceEnds.push(startVoice(target, voice, at, pitch, level));
    }
  });
}

/** Turns sound on or off at once; off also stops the audio clock, so it costs nothing. */
function setEnabled(value: boolean): void {
  safely(() => {
    listen();
    enabled = value;
    if (value) wake();
    else sleep();
  });
}

export const sound = {
  play,
  setEnabled,
  isEnabled: (): boolean => enabled
};
