/** Apple keyboards name their modifier keys differently: ⌘ for Ctrl, ⌥ for Alt. */
export const isApple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
