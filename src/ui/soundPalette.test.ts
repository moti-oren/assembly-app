import { describe, expect, it } from 'vitest';
import { SOUNDS, type Sound } from './soundPalette';

const sounds = Object.entries(SOUNDS) as [string, Sound][];
const voices = sounds.flatMap(([name, sound]) => sound.voices.map((voice) => ({ name, voice })));

describe('the sound palette', () => {
  it('gives every voice an attack long enough not to pop', () => {
    for (const { name, voice } of voices) {
      expect(voice.attack, name).toBeGreaterThanOrEqual(0.002);
    }
  });

  it('keeps every sound short and dry', () => {
    for (const [name, sound] of sounds) {
      const ends = sound.voices.map((voice) => (voice.at ?? 0) + voice.attack + voice.decay);
      expect(Math.max(...ends), name).toBeLessThanOrEqual(0.25);
    }
  });

  it('stays out of the piercing highs, and never loud', () => {
    for (const { name, voice } of voices) {
      const top = voice.kind === 'noise' ? voice.freq : Math.max(voice.from, voice.to ?? 0);
      expect(top, name).toBeLessThanOrEqual(4000);
      expect(voice.gain, name).toBeLessThanOrEqual(0.5);
    }
  });

  it('keeps the interface lighter than the CPU', () => {
    const loudest = (sound: Sound) => Math.max(...sound.voices.map((voice) => voice.gain));
    expect(loudest(SOUNDS.pick)).toBeLessThan(loudest(SOUNDS.register));
    expect(loudest(SOUNDS.clock)).toBeLessThan(loudest(SOUNDS.register));
  });

  it('never uses more voices than can sound at once', () => {
    for (const [name, sound] of sounds) {
      expect(sound.voices.length, name).toBeLessThanOrEqual(3);
    }
  });
});
