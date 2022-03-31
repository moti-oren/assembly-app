export interface EventHandler {
  (...args: any[]): void;
}

export interface HandlerObject {
  once: boolean;
  func: EventHandler;
}

export interface Events {
  [key: string]: Array<HandlerObject>;
}

export interface EventEmitter {
  on: (name: string, callback: EventHandler) => void;
  once: (name: string, callback: EventHandler) => void;
  prependListener: (name: string, callback: EventHandler) => void;
  prependOnceListener: (name: string, callback: EventHandler) => void;
  off: (name: string, callback: EventHandler) => void;
  offAll: (name: string) => void;
  setMaxListeners: (n: number) => void;
  getMaxListeners: () => number;
  listeners: (name: string) => Array<EventHandler>;
  eventNames: () => Array<string>;
  emit: (name: string, ...args: any[]) => void;
}
