/** Every localStorage key the app uses, in one place so a new one cannot collide with another. */
export const STORAGE_KEYS = {
  sound: '8086-sound',
  cpuView: '8086-cpu-view',
  registerBits: '8086-register-bits',
  reduceMotion: '8086-reduce-motion',
  panelOrder: '8086-panel-order',
  sidebarLayout: '8086-sidebar-layout',
  historyShown: '8086-history-shown',
  bytesShown: '8086-bytes-shown',
  devicesShown: '8086-devices-shown',
  architecture: '8086-architecture',
  rv32Pipeline: '8086-rv32-pipeline',
  rv32Forwarding: '8086-rv32-forwarding'
} as const;
