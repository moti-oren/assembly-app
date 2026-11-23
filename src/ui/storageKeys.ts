/** Every localStorage key the app uses, in one place so a new one cannot collide with another. */
export const STORAGE_KEYS = {
  /** VueUse's own key for the colour mode, kept so a theme chosen earlier is still read. */
  theme: 'vueuse-color-scheme',
  sound: '8086-sound',
  cpuView: '8086-cpu-view',
  registerBits: '8086-register-bits',
  reduceMotion: '8086-reduce-motion',
  panelOrder: '8086-panel-order',
  sidebarLayout: '8086-sidebar-layout',
  historyShown: '8086-history-shown',
  bytesShown: '8086-bytes-shown',
  devicesShown: '8086-devices-shown',
  stackShown: '8086-stack-shown',
  architecture: '8086-architecture',
  topic: '8086-topic',
  analytics: '8086-analytics',
  runSpeed: '8086-run-speed',
  autoOpenDevices: '8086-auto-open-devices',
  confirmReset: '8086-confirm-reset',
  rv32Pipeline: '8086-rv32-pipeline',
  rv32Forwarding: '8086-rv32-forwarding',
  rv32Predictor: '8086-rv32-predictor',
  prediction: '8086-prediction',
  predictStep: '8086-predict-step',
  predictBuilder: '8086-predict-builder',
  predictRun: '8086-predict-run',
  /** One program per architecture; the architecture's id is added to it (see programStorage). */
  program: '8086-program'
} as const;
