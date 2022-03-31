import { EventHandler } from '../types/event-emitter';
import { Events } from '../types/event-emitter';
import { EventEmitter as IEventEmitter } from '../types/event-emitter';

export class EventEmitter implements IEventEmitter {
  protected events: Events = {};
  protected maxListeners: number = 0;

  on (name: string, func: EventHandler) {
    this.addHandler(name, func);
    this.emit('newListener');

    return this;
  }

  once (name: string, func: EventHandler) {
    this.addHandler(name, func, true);
    this.emit('newListener');

    return this;
  }

  prependListener (name: string, func: EventHandler) {
    this.addHandler(name, func, false, true);
    this.emit('newListener');

    return this;
  }

  prependOnceListener (name: string, func: EventHandler) {
    this.addHandler(name, func, true, true);
    this.emit('newListener');

    return this;
  }

  off (name: string, func: EventHandler) {
    this.removeHandler(name, func);
    this.emit('removeListener');

    return this;
  }

  offAll (name: string) {
    this.removeEvent(name);
    this.emit('removeListener');

    return this;
  }

  emit (name: string, ...args: any[]) {
    const targetEvent = this.getEvent(name);

    if (!targetEvent) {
      return false;
    }

    targetEvent.forEach((eventHandler) => {
      eventHandler.func(name, ...args); // TODO: Error handle
      if (eventHandler.once) {
        this.off(name, eventHandler.func);
      }
    });

    return true;
  }

  setMaxListeners (n: number) {
    this.maxListeners = n;

    return this;
  }

  getMaxListeners () {
    return this.maxListeners;
  }

  eventNames () {
    return Object.keys(this.events);
  }

  listeners (name: string) {
    const targetEvent = this.getEvent(name);

    if (targetEvent) {
      return targetEvent.filter((eventHandler) => !eventHandler.once).map((eventHandler) => eventHandler.func);
    }

    return [];
  }

  listenerCount (name: string) {
    const targetEvent = this.getEvent(name);

    if (targetEvent) {
      return targetEvent.length;
    }

    return 0;
  }

  rawListeners (name: string) {
    const targetEvent = this.getEvent(name);

    if (targetEvent) {
      return targetEvent.map((eventHandler) => eventHandler.func);
    }

    return [];
  }

  protected addHandler (name: string, func: EventHandler, once: boolean = false, prepend: boolean = false) {
    if (this.events[name]) {
      const targetEvent = this.getEvent(name);
      if (this.maxListeners && targetEvent.length >= this.maxListeners) {
        return; // TODO
      }
      targetEvent.push({ func, once });
      return;
    }
    if (prepend) {
      this.events[name].unshift({ func, once });
    } else {
      this.events[name].push({ func, once });
    }
  }

  protected removeHandler (name: string, func: EventHandler) {
    if (!this.events[name]) {
      return;
    }

    this.events[name] = this.events[name].filter((eventHandler) => eventHandler.func !== func);
  }

  protected removeEvent (name: string) {
    if (!this.events[name]) {
      return;
    }

    delete this.events[name];
  }

  protected getEvent (name: string) {
    return this.events[name];
  }
}

export const eventEmitter = new EventEmitter();

// TODO
