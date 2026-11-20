/**
 * The app's sounds, as data. Each is one to three short voices: a burst of filtered noise for
 * the tap of a small mechanism, and a sine or triangle for its pitch. The tonal ones sit on
 * G, D and their octaves, so sounds that overlap never clash.
 */

/** A burst of band-passed noise: a contact closing. */
interface NoiseVoice {
  kind: 'noise';
  /** Centre of the band: higher is a smaller, harder contact. */
  freq: number;
  q: number;
}

/** A pitched pulse, gliding from one frequency to another when `to` is given. */
interface ToneVoice {
  kind: 'tone';
  wave: 'sine' | 'triangle';
  from: number;
  to?: number;
}

export type Voice = (NoiseVoice | ToneVoice) & {
  /** Seconds after the sound starts. */
  at?: number;
  /** Seconds to rise to `gain`: long enough that the voice never starts with a pop. */
  attack: number;
  /** Seconds to fade out after the attack. */
  decay: number;
  gain: number;
};

export interface Sound {
  voices: readonly Voice[];
  /** Seconds before the same sound may play again; the engine's default when left out. */
  cooldown?: number;
}

const G3 = 196;
const D4 = 293.66;
const G4 = 392;
const D5 = 587.33;

const tap = (freq: number, q: number, decay: number, gain: number, at = 0): Voice => ({
  kind: 'noise',
  freq,
  q,
  at,
  attack: 0.002,
  decay,
  gain
});

const tone = (from: number, decay: number, gain: number, at = 0, to?: number): Voice => ({
  kind: 'tone',
  wave: 'sine',
  from,
  to,
  at,
  attack: 0.004,
  decay,
  gain
});

export const SOUNDS = {
  // The cycle: fetch, decode and the executed instruction climb G3, D4, G4.
  fetch: { voices: [tone(G3, 0.07, 0.3), tap(500, 1.5, 0.02, 0.08)] },
  decode: { voices: [tap(2400, 6, 0.018, 0.26), tone(D4, 0.04, 0.14)] },

  // One executed instruction, named for what it did.
  register: { voices: [tap(3000, 4, 0.014, 0.2), tone(G4, 0.055, 0.2)] },
  memory: { voices: [tap(1500, 3, 0.02, 0.22), tone(D4, 0.075, 0.24)] },
  push: { voices: [tap(1500, 3, 0.018, 0.18), tone(330, 0.065, 0.22, 0, 247)] },
  pop: { voices: [tap(1500, 3, 0.018, 0.18), tone(247, 0.065, 0.22, 0, 330)] },
  'jump-forward': { voices: [tap(2200, 4, 0.012, 0.12), tone(G4, 0.075, 0.22, 0, D5)] },
  'jump-back': { voices: [tap(2200, 4, 0.012, 0.12), tone(D5, 0.075, 0.22, 0, G4)] },
  'no-jump': { voices: [tap(1200, 2, 0.014, 0.14)] },
  call: { voices: [tone(G4, 0.045, 0.2), tone(D5, 0.06, 0.2, 0.055)] },
  ret: { voices: [tone(D5, 0.045, 0.2), tone(G4, 0.06, 0.2, 0.055)] },
  flags: { voices: [tap(3600, 8, 0.012, 0.16)] },
  idle: { voices: [tap(900, 1.5, 0.012, 0.1)] },
  /** Laid under the instruction that broke a signed result. */
  overflow: { voices: [tone(110, 0.12, 0.3, 0, 98)] },

  // Running fast: one soft pulse per line, instead of everything the line did.
  clock: { voices: [tone(G3, 0.03, 0.12), tap(1800, 3, 0.012, 0.06)], cooldown: 0.06 },
  halt: { voices: [tone(D4, 0.09, 0.22), tone(G3, 0.12, 0.24, 0.1)] },
  error: { voices: [tone(110, 0.12, 0.45, 0, 70), tap(300, 1, 0.03, 0.2)], cooldown: 0.15 },

  // RISC-V's pipeline: a tick per instruction, and what the overlap cost or saved.
  'pipeline-tick': { voices: [tap(2600, 6, 0.012, 0.16), tone(523, 0.02, 0.05)] },
  forward: { voices: [tone(659, 0.035, 0.1, 0, 784)] },
  stall: { voices: [tone(185, 0.07, 0.18)] },

  // The devices.
  'switch-on': {
    voices: [
      tap(2600, 3, 0.014, 0.36),
      {
        kind: 'tone',
        wave: 'triangle',
        from: 700,
        to: 500,
        attack: 0.002,
        decay: 0.014,
        gain: 0.12
      }
    ]
  },
  'switch-off': {
    voices: [
      tap(1900, 3, 0.016, 0.34),
      {
        kind: 'tone',
        wave: 'triangle',
        from: 520,
        to: 380,
        attack: 0.002,
        decay: 0.016,
        gain: 0.12
      }
    ]
  },
  led: { voices: [tone(659, 0.025, 0.07)] },
  terminal: { voices: [tap(3200, 7, 0.012, 0.1)], cooldown: 0.06 },

  // The interface: lighter than anything the CPU does.
  pick: { voices: [tap(1100, 1.5, 0.012, 0.12)], cooldown: 0.035 },
  add: { voices: [tap(1600, 2.5, 0.014, 0.18), tone(330, 0.035, 0.1, 0, G4)] },
  remove: { voices: [tap(1600, 2.5, 0.014, 0.18), tone(330, 0.035, 0.1, 0, 262)] },
  /** A selector clicking into place: switching architecture, and reset. */
  detent: {
    voices: [tap(1400, 3, 0.016, 0.3), tap(2300, 4, 0.012, 0.2, 0.022), tone(150, 0.04, 0.15)],
    cooldown: 0.1
  },
  undo: { voices: [tap(2000, 5, 0.012, 0.14), tone(440, 0.035, 0.12, 0, 370)], cooldown: 0.05 },
  redo: { voices: [tap(2000, 5, 0.012, 0.14), tone(370, 0.035, 0.12, 0, 440)], cooldown: 0.05 }
} satisfies Record<string, Sound>;

export type SoundName = keyof typeof SOUNDS;
