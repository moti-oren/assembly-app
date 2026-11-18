/** Every localStorage key the app uses, in one place so a new one cannot collide with another. */
export const STORAGE_KEYS = {
  sound: '8086-sound',
  cpuView: '8086-cpu-view',
  reduceMotion: '8086-reduce-motion',
  panelOrder: '8086-panel-order',
  architecture: '8086-architecture'
} as const;
